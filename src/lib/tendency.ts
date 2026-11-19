/** Temperature tendency over the last hour, from DWD station observations (Bright Sky). */

/** Change (°C) from which the arrow points up or down; below that it is "gleichbleibend". */
export const TENDENCY_THRESHOLD = 0.5;
/** Accepted distance (minutes) of the comparison value from exactly one hour ago. */
const TOLERANCE_MIN = 10;

export type TendencyDir = 'up' | 'down' | 'flat';

export interface Tendency {
  delta: number;
  dir: TendencyDir;
  /** Timestamp of the comparison value (ISO with offset). */
  from: string;
}

/** Shifts a local ISO timestamp ("…T13:30:00+01:00") by minutes, keeping its offset. */
function isoLocal(ts: string, minutes: number): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(.*)$/.exec(ts);
  if (!m) return ts;
  const total = Number(m[2]) * 60 + Number(m[3]) + minutes;
  const hh = String(Math.floor((((total % 1440) + 1440) % 1440) / 60)).padStart(2, '0');
  const mm = String((((total % 60) + 60) % 60)).padStart(2, '0');
  return `${m[1]}T${hh}:${mm}${m[4].replace(/^:\d{2}/, ':00')}`;
}

export interface PastWeather {
  weather: { timestamp: string; temperature: number | null; source_id: number }[];
  sources: { id: number; dwd_station_id?: string | null; observation_type?: string }[];
}

/**
 * Compares the current reading with the observation of the same station about 60 minutes earlier.
 * Forecast records (which Bright Sky mixes into /weather) are ignored. Returns null if no
 * suitable value exists; nothing is estimated.
 */
export function tendencyFrom(
  current: { timestamp: string; temperature: number | null; stationId?: string | null },
  past: PastWeather,
): Tendency | null {
  if (current.temperature == null) return null;
  const target = Date.parse(current.timestamp) - 60 * 60_000;
  if (!Number.isFinite(target)) return null;
  const okSource = new Set(
    past.sources
      .filter((s) => s.observation_type !== 'forecast')
      .filter((s) => !current.stationId || !s.dwd_station_id || s.dwd_station_id === current.stationId)
      .map((s) => s.id),
  );
  const recs = past.weather
    .filter((r) => r.temperature != null && okSource.has(r.source_id))
    .map((r) => ({ t: Date.parse(r.timestamp), temp: r.temperature as number, ts: r.timestamp }))
    .filter((r) => Number.isFinite(r.t))
    .sort((a, b) => a.t - b.t);
  let then: number | null = null;
  let from = '';
  const near = recs.find((r) => Math.abs(r.t - target) <= TOLERANCE_MIN * 60_000);
  if (near) {
    then = near.temp;
    from = near.ts;
  } else {
    // The station reports every 30 min, the hourly archive only on the hour: interpolate linearly
    // between the two observations around the target time (both at most an hour away).
    const before = [...recs].reverse().find((r) => r.t < target && target - r.t <= 60 * 60_000);
    const after = recs.find((r) => r.t > target && r.t - target <= 60 * 60_000);
    if (!before || !after) return null;
    const f = (target - before.t) / (after.t - before.t);
    then = before.temp + (after.temp - before.temp) * f;
    from = isoLocal(current.timestamp, -60);
  }
  const delta = Math.round((current.temperature - then) * 10) / 10;
  const dir: TendencyDir = delta >= TENDENCY_THRESHOLD ? 'up' : delta <= -TENDENCY_THRESHOLD ? 'down' : 'flat';
  return { delta, dir, from };
}
