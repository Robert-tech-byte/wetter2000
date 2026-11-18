import { useEffect, useState } from 'react';
import type { TrendData } from './trend';

/** Loads trend.json published next to the app; null if missing. */
export function useTrend(): TrendData | null {
  const [data, setData] = useState<TrendData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}trend.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && Array.isArray(d.days) && setData(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
