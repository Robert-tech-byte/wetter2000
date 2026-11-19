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
  let best: { t: number; rec: PastWeather['weather'][number] } | null = null;
  for (const rec of past.weather) {
    if (rec.temperature == null || !okSource.has(rec.source_id)) continue;
    const dt = Math.abs(Date.parse(rec.timestamp) - target);
    if (dt > TOLERANCE_MIN * 60_000) continue;
    if (!best || dt < best.t) best = { t: dt, rec };
  }
  if (!best) return null;
  const delta = Math.round((current.temperature - best.rec.temperature!) * 10) / 10;
  const dir: TendencyDir = delta >= TENDENCY_THRESHOLD ? 'up' : delta <= -TENDENCY_THRESHOLD ? 'down' : 'flat';
  return { delta, dir, from: best.rec.timestamp };
}
