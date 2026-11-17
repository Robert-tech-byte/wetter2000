import type { FoehnSeries } from './api';
import { FOEHN } from './config';

export interface FoehnDay {
  date: string;
  active: boolean;
  /** Hours meeting all criteria. */
  hours: number;
  /** Largest pressure difference Bozen − München (hPa). */
  maxDiff: number | null;
  /** Lowest humidity in München during qualifying hours (or the whole day). */
  minHumidity: number | null;
  /** Typical 700 hPa wind direction during the strongest hour. */
  dir700: number | null;
  /** false if upper-level wind was unavailable and only pressure + humidity were used. */
  withUpperWind: boolean;
}

const inSector = (d: number) => d >= FOEHN.dirFrom && d <= FOEHN.dirTo;
const num = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Applies the Föhn rule of thumb per calendar day. */
export function analyzeFoehn(munich: FoehnSeries, bozen: FoehnSeries): FoehnDay[] {
  const bIndex = new Map(bozen.time.map((t, i) => [t, i]));
  const hasUpper = (munich.dir700 ?? []).some(num);
  const byDay = new Map<string, FoehnDay>();
  munich.time.forEach((t, i) => {
    const date = t.slice(0, 10);
    const hour = Number(t.slice(11, 13));
    let day = byDay.get(date);
    if (!day) {
      day = { date, active: false, hours: 0, maxDiff: null, minHumidity: null, dir700: null, withUpperWind: hasUpper };
      byDay.set(date, day);
    }
    if (hour < FOEHN.hours[0] || hour >= FOEHN.hours[1]) return;
    const j = bIndex.get(t);
    const pm = munich.pressure[i];
    const pb = j == null ? null : bozen.pressure[j];
    if (!num(pm) || !num(pb)) return;
    const diff = pb - pm;
    const rh = munich.humidity?.[i];
    const dir = munich.dir700?.[i];
    if (day.maxDiff == null || diff > day.maxDiff) {
      day.maxDiff = diff;
      day.dir700 = num(dir) ? dir : null;
    }
    const ok =
      diff >= FOEHN.minPressureDiff &&
      num(rh) &&
      rh < FOEHN.maxHumidity &&
      (!hasUpper || (num(dir) && inSector(dir)));
    if (ok) {
      day.hours++;
      day.minHumidity = day.minHumidity == null ? rh : Math.min(day.minHumidity, rh);
    }
  });
  for (const d of byDay.values()) d.active = d.hours >= FOEHN.minHours;
  return [...byDay.values()];
}
