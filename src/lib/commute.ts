import { RAIN_THRESHOLD } from './config';
import type { Km } from './geo';
import { kmToGrid, sample, type RadarData } from './radar';

/** Average cycling speed. */
export const SPEED_KMH = 20;
export const DURATIONS = [10, 20, 30, 40] as const;
export type Duration = (typeof DURATIONS)[number];

export const DIRECTIONS = [
  { id: 'N', label: 'Norden', deg: 0 },
  { id: 'NO', label: 'Nordosten', deg: 45 },
  { id: 'O', label: 'Osten', deg: 90 },
  { id: 'SO', label: 'Südosten', deg: 135 },
  { id: 'S', label: 'Süden', deg: 180 },
  { id: 'SW', label: 'Südwesten', deg: 225 },
  { id: 'W', label: 'Westen', deg: 270 },
  { id: 'NW', label: 'Nordwesten', deg: 315 },
] as const;
export type DirectionId = (typeof DIRECTIONS)[number]['id'];

export type Trip = 'hin' | 'heim';

/**
 * Straight route between home and work. `homeDir` is the direction in which home lies,
 * seen from the workplace. "hin" = home → work, "heim" = work → home.
 */
export function route(work: Km, homeDir: DirectionId, minutes: number, trip: Trip): Km[] {
  const deg = DIRECTIONS.find((d) => d.id === homeDir)!.deg;
  const dist = (SPEED_KMH * minutes) / 60;
  const rad = (deg * Math.PI) / 180;
  const home: Km = [work[0] + Math.sin(rad) * dist, work[1] + Math.cos(rad) * dist];
  return trip === 'hin' ? [home, work] : [work, home];
}

function along(r: Km[], f: number): Km {
  const [a, b] = r;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export interface Option {
  /** Minutes from now. */
  depart: number;
  departAt: Date;
  /** Expected precipitation collected during the trip (mm). */
  mm: number;
  /** Highest rate met on the way (mm/h). */
  peak: number;
  source: 'radar' | 'modell';
}

export const isDry = (o: Pick<Option, 'mm' | 'peak'>) => o.mm < 0.05 && o.peak < RAIN_THRESHOLD;

export function wetness(o: Pick<Option, 'mm' | 'peak'>): string {
  if (isDry(o)) return 'trocken';
  if (o.mm < 0.3) return 'ein paar Tropfen';
  if (o.mm < 1) return 'nass';
  return 'sehr nass';
}

/** Departures evaluated with radar + nowcast (every 5 min while the trip fits into the nowcast). */
export function radarOptions(data: RadarData, r: Km[], minutes: number, now: Date): Option[] {
  const toGrid = kmToGrid(data.cornersKm, data.rows, data.cols);
  const latest = new Date(data.latestObservation).getTime();
  const lastFrame = data.frames.length - 1;
  const frameAt = (ms: number) => data.latestIndex + (ms - latest) / 300000;
  const rateAt = (ms: number, p: Km) => {
    const t = Math.max(0, frameAt(ms));
    const k = Math.min(lastFrame, Math.floor(t));
    const k1 = Math.min(lastFrame, k + 1);
    const f = t - k;
    const [row, col] = toGrid(p[0], p[1]);
    return (
      sample(data.frames[k].rate, data.rows, data.cols, row, col) * (1 - f) +
      sample(data.frames[k1].rate, data.rows, data.cols, row, col) * f
    );
  };
  const out: Option[] = [];
  for (let depart = 0; depart <= 60; depart += 5) {
    const start = now.getTime() + depart * 60000;
    if (frameAt(start + minutes * 60000) > lastFrame + 1e-6) break;
    let mm = 0;
    let peak = 0;
    for (let m = 0; m < minutes; m++) {
      const v = rateAt(start + (m + 0.5) * 60000, along(r, (m + 0.5) / minutes));
      mm += v / 60;
      peak = Math.max(peak, v);
    }
    out.push({ depart, departAt: new Date(start), mm, peak, source: 'radar' });
  }
  return out;
}

/** Later departures from ICON-D2 15-minute sums at the route midpoint (less precise). */
export function modelOptions(
  slots: { start: Date; mm15: number }[],
  minutes: number,
  now: Date,
  from: number,
  until = 180,
): Option[] {
  const rate = (ms: number) => {
    const s = slots.find((x) => ms >= x.start.getTime() && ms < x.start.getTime() + 900000);
    return s ? s.mm15 * 4 : null;
  };
  const out: Option[] = [];
  for (let depart = Math.ceil(from / 15) * 15; depart <= until; depart += 15) {
    const start = now.getTime() + depart * 60000;
    let mm = 0;
    let peak = 0;
    let ok = true;
    for (let m = 0; m < minutes; m++) {
      const v = rate(start + (m + 0.5) * 60000);
      if (v == null) {
        ok = false;
        break;
      }
      mm += v / 60;
      peak = Math.max(peak, v);
    }
    if (!ok) break;
    out.push({ depart, departAt: new Date(start), mm, peak, source: 'modell' });
  }
  return out;
}

/** Best departure: least rain; ties (±0.02 mm) go to the earliest, radar before model. */
export function best(options: Option[]): Option | null {
  if (!options.length) return null;
  const min = Math.min(...options.map((o) => o.mm));
  return options.find((o) => o.mm <= min + 0.02) ?? null;
}
