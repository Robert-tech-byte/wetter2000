import { useEffect, useState } from 'react';
import type { PressureData } from './pressure';

/** Loads pressure.json published next to the app; null if missing (e.g. local dev or failed build step). */
export function usePressure(): PressureData | null {
  const [data, setData] = useState<PressureData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}pressure.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d && Array.isArray(d.days) && setData(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
