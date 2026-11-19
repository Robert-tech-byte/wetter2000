import type { ConfidenceLevel } from './agreement';
import type { ModelSeries } from './api';
import { MIN_COVERAGE, RAIN_THRESHOLD, TEMP_TOLERANCE } from './config';

export interface ModelDay {
  tMax: number;
  tMin: number;
  rainSum: number;
  rains: boolean;
}

/** ECMWF main run compared with one second model (ICON-EU) for one calendar day. */
export interface PairDay {
  date: string;
  /** Hours in which both models have values. */
  hours: number;
  /** Hours in which both are within ±TEMP_TOLERANCE of each other. */
  inTol: number;
  ecmwf: ModelDay;
  other: ModelDay;
  rainAgree: boolean;
  tempLevel: ConfidenceLevel;
  rainLevel: ConfidenceLevel;
  /** The weaker of the two, as for the first days. */
  level: ConfidenceLevel;
}

const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function stats(t: number[], r: number[]): ModelDay {
  return {
    tMax: Math.max(...t),
    tMin: Math.min(...t),
    rainSum: r.reduce((a, b) => a + b, 0),
    rains: r.some((v) => v >= RAIN_THRESHOLD),
  };
}

/**
 * Compares two hourly series day by day. Only hours present in both are used; a day counts
 * only if they cover at least MIN_COVERAGE of its hours (ICON-EU ends after about 120 h).
 */
export function pairDays(base: ModelSeries, other: ModelSeries, dates: string[]): PairDay[] {
  const idx = new Map(other.time.map((t, i) => [t, i]));
  const out: PairDay[] = [];
  for (const date of dates) {
    const bt: number[] = [];
    const br: number[] = [];
    const ot: number[] = [];
    const or: number[] = [];
    let total = 0;
    let inTol = 0;
    base.time.forEach((t, i) => {
      if (!t.startsWith(date)) return;
      total++;
      const j = idx.get(t);
      if (j == null) return;
      const a = base.temperature[i];
      const b = other.temperature[j];
      const ra = base.precipitation[i];
      const rb = other.precipitation[j];
      if (!isNum(a) || !isNum(b) || !isNum(ra) || !isNum(rb)) return;
      bt.push(a);
      ot.push(b);
      br.push(ra);
      or.push(rb);
      if (Math.abs(a - b) <= TEMP_TOLERANCE) inTol++;
    });
    if (!total || bt.length / total < MIN_COVERAGE) continue;
    const e = stats(bt, br);
    const o = stats(ot, or);
    const share = inTol / bt.length;
    const tempLevel: ConfidenceLevel = share >= 0.8 ? 3 : share >= 0.5 ? 2 : 1;
    const rainAgree = e.rains === o.rains;
    const rainLevel: ConfidenceLevel = rainAgree ? 3 : 1;
    out.push({
      date,
      hours: bt.length,
      inTol,
      ecmwf: e,
      other: o,
      rainAgree,
      tempLevel,
      rainLevel,
      level: Math.min(tempLevel, rainLevel) as ConfidenceLevel,
    });
  }
  return out;
}
