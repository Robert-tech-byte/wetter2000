import { useCallback, useEffect, useState } from 'react';
import {
  fetchCurrentObservation,
  fetchEcmwf,
  fetchEnsemble,
  fetchHiresModels,
  type CurrentObservation,
  type EcmwfForecast,
  type MemberSet,
} from './api';

export interface Loadable<T> {
  data: T | null;
  error: string | null;
}

export interface WeatherState {
  loading: boolean;
  updatedAt: Date | null;
  ecmwf: Loadable<EcmwfForecast>;
  hires: Loadable<MemberSet>;
  eps: Loadable<MemberSet>;
  current: Loadable<CurrentObservation>;
}

const empty = { data: null, error: null };

function settle<T>(r: PromiseSettledResult<T>): Loadable<T> {
  return r.status === 'fulfilled'
    ? { data: r.value, error: null }
    : { data: null, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
}

const REFRESH_MS = 30 * 60 * 1000;

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    loading: true,
    updatedAt: null,
    ecmwf: empty,
    hires: empty,
    eps: empty,
    current: empty,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const [ecmwf, hires, eps, current] = await Promise.allSettled([
      fetchEcmwf(),
      fetchHiresModels(),
      fetchEnsemble(),
      fetchCurrentObservation(),
    ]);
    setState({
      loading: false,
      updatedAt: new Date(),
      ecmwf: settle(ecmwf),
      hires: settle(hires),
      eps: settle(eps),
      current: settle(current),
    });
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { ...state, reload: load };
}
