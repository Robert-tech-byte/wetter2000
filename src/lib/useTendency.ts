import { useEffect, useState } from 'react';
import { fetchPastWeather, type CurrentObservation } from './api';
import { tendencyFrom, type Tendency } from './tendency';

/** Temperature tendency of the last hour for the current station reading; null if unknown. */
export function useTendency(current: CurrentObservation | null): Tendency | null {
  const [tendency, setTendency] = useState<Tendency | null>(null);
  const ts = current?.weather.timestamp;
  const temp = current?.weather.temperature ?? null;
  const sourceId = current?.weather.source_id;
  const stationId = current?.sources.find((s) => s.id === sourceId)?.dwd_station_id ?? current?.sources[0]?.dwd_station_id ?? null;

  useEffect(() => {
    setTendency(null);
    if (!ts || temp == null) return;
    const end = Date.parse(ts);
    if (!Number.isFinite(end)) return;
    let alive = true;
    const from = new Date(end - 120 * 60_000).toISOString();
    fetchPastWeather(from, new Date(end).toISOString())
      .then((past) => alive && setTendency(tendencyFrom({ timestamp: ts, temperature: temp, stationId }, past)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ts, temp, stationId]);

  return tendency;
}
