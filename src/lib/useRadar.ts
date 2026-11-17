import { useCallback, useEffect, useState } from 'react';
import { fetchRadar } from './api';
import { parseRadar, type RadarData } from './radar';

const REFRESH_MS = 5 * 60 * 1000;

export function useRadar() {
  const [data, setData] = useState<RadarData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(parseRadar(await fetchRadar()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { data, error, reload: load };
}
