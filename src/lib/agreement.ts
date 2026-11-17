import { MIN_COVERAGE, RAIN_THRESHOLD, TEMP_TOLERANCE } from './config';

export interface Member {
  id: string;
  label: string;
  temperature: (number | null)[];
  precipitation: (number | null)[];
}

export interface MemberDayStats {
  id: string;
  label: string;
  tMax: number;
  tMin: number;
  rainSum: number;
  rains: boolean;
}

export interface DayAgreement {
  date: string;
  /** Hour indices [start, end) evaluated for this day. */
  hours: number;
  /** Members that covered enough hours of the day. */
  members: MemberDayStats[];
  /** Mean over hours of the share of members within ±tolerance of the hourly median (0–1). */
  tempAgreement: number | null;
  tMaxMedian: number | null;
  tMaxRange: [number, number] | null;
  tMinMedian: number | null;
  tMinRange: [number, number] | null;
  /** Share of members with at least one hour ≥ RAIN_THRESHOLD (0–1). */
  rainProbability: number | null;
  rainMembers: number;
  rainSumMedian: number | null;
  rainSumRange: [number, number] | null;
}

export interface HourAgreement {
  time: string;
  n: number;
  tempMedian: number | null;
  tempLow: number | null;
  tempHigh: number | null;
  /** Share of members within tolerance of the median. */
  tempAgreement: number | null;
  /** Share of members with ≥ RAIN_THRESHOLD mm in this hour. */
  rainProbability: number | null;
  rainMedian: number | null;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function range(values: number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function hourAgreement(time: string[], members: Member[], index: number): HourAgreement {
  const temps = members.map((m) => m.temperature[index]).filter(isNum);
  const rains = members.map((m) => m.precipitation[index]).filter(isNum);
  const med = temps.length ? median(temps) : null;
  return {
    time: time[index],
    n: temps.length,
    tempMedian: med,
    tempLow: temps.length ? Math.min(...temps) : null,
    tempHigh: temps.length ? Math.max(...temps) : null,
    tempAgreement:
      med == null ? null : temps.filter((t) => Math.abs(t - med) <= TEMP_TOLERANCE).length / temps.length,
    rainProbability: rains.length ? rains.filter((r) => r >= RAIN_THRESHOLD).length / rains.length : null,
    rainMedian: rains.length ? median(rains) : null,
  };
}

/**
 * Agreement for one calendar day, using hourly indices [start, end).
 * Members covering less than MIN_COVERAGE of these hours are dropped for that day,
 * so a model that ends at 10:00 does not distort the daily max/min or rain sum.
 */
export function dayAgreement(
  time: string[],
  members: Member[],
  start: number,
  end: number,
): DayAgreement {
  const hours = end - start;
  const date = time[start]?.slice(0, 10) ?? '';
  const used: Member[] = [];
  const stats: MemberDayStats[] = [];

  for (const m of members) {
    const temps: number[] = [];
    const rains: number[] = [];
    for (let i = start; i < end; i++) {
      if (isNum(m.temperature[i])) temps.push(m.temperature[i] as number);
      if (isNum(m.precipitation[i])) rains.push(m.precipitation[i] as number);
    }
    if (hours === 0 || temps.length / hours < MIN_COVERAGE || rains.length / hours < MIN_COVERAGE) continue;
    used.push(m);
    stats.push({
      id: m.id,
      label: m.label,
      tMax: Math.max(...temps),
      tMin: Math.min(...temps),
      rainSum: rains.reduce((a, b) => a + b, 0),
      rains: rains.some((r) => r >= RAIN_THRESHOLD),
    });
  }

  const hourly: number[] = [];
  for (let i = start; i < end; i++) {
    const h = hourAgreement(time, used, i);
    if (h.tempAgreement != null && h.n >= 2) hourly.push(h.tempAgreement);
  }

  const n = stats.length;
  const tMax = stats.map((s) => s.tMax);
  const tMin = stats.map((s) => s.tMin);
  const sums = stats.map((s) => s.rainSum);
  const rainMembers = stats.filter((s) => s.rains).length;

  return {
    date,
    hours,
    members: stats,
    tempAgreement: n >= 2 && hourly.length ? hourly.reduce((a, b) => a + b, 0) / hourly.length : null,
    tMaxMedian: n ? median(tMax) : null,
    tMaxRange: n ? range(tMax) : null,
    tMinMedian: n ? median(tMin) : null,
    tMinRange: n ? range(tMin) : null,
    rainProbability: n ? rainMembers / n : null,
    rainMembers,
    rainSumMedian: n ? median(sums) : null,
    rainSumRange: n ? range(sums) : null,
  };
}

/**
 * Splits the hourly series into calendar days (local time) and evaluates each day.
 * For today only the hours from `nowKey` onwards are used.
 */
export function analyzeDays(time: string[], members: Member[], nowKey: string, days: number): DayAgreement[] {
  const dates = [...new Set(time.map((t) => t.slice(0, 10)))].slice(0, days);
  return dates.map((d) => {
    let start = time.findIndex((t) => t.startsWith(d));
    let end = start;
    while (end < time.length && time[end].startsWith(d)) end++;
    if (nowKey.startsWith(d)) {
      const nowIdx = time.indexOf(nowKey);
      if (nowIdx >= start) start = Math.min(nowIdx, end - 1);
    }
    return dayAgreement(time, members, start, end);
  });
}

export type Confidence = 'hoch' | 'mittel' | 'niedrig';

export function confidenceLabel(share: number | null): Confidence | null {
  if (share == null) return null;
  if (share >= 0.8) return 'hoch';
  if (share >= 0.5) return 'mittel';
  return 'niedrig';
}

/** How strongly members agree on "rain yes/no": 50 % split → 0.5, unanimous → 1. */
export function rainConsensus(p: number | null): number | null {
  return p == null ? null : Math.max(p, 1 - p);
}
