import type { RadarResponse } from './api';
import { toKm, type Km } from './geo';

export interface RadarFrame {
  timestamp: string;
  isForecast: boolean;
  /** Minutes relative to the latest observation (negative = past). */
  offsetMinutes: number;
  /** Precipitation rate in mm/h, row-major, row 0 = north. */
  rate: Float32Array;
  /** Lightly smoothed copy for display (removes single-pixel speckle). */
  display: Float32Array;
}

export interface RadarData {
  frames: RadarFrame[];
  rows: number;
  cols: number;
  /** Grid corners in km: top-left, bottom-left, bottom-right, top-right. */
  cornersKm: Km[];
  /** Fractional grid position of the city centre. */
  position: { row: number; col: number };
  latestIndex: number;
  latestObservation: string;
}

/** Bright Sky delivers 0.01 mm per 5 minutes → mm/h. */
export const toRate = (raw: number) => (raw / 100) * 12;

export function parseRadar(res: RadarResponse): RadarData {
  const records = [...res.radar].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const runOf = (source: string) => source.split('::').pop() ?? '';
  const isObserved = (r: (typeof records)[number]) =>
    new Date(runOf(r.source)).getTime() === new Date(r.timestamp).getTime();
  let latestIndex = -1;
  records.forEach((r, i) => {
    if (isObserved(r)) latestIndex = i;
  });
  if (latestIndex < 0) latestIndex = 0;
  const latestMs = new Date(records[latestIndex]?.timestamp ?? 0).getTime();

  const rows = records[0]?.precipitation_5.length ?? 0;
  const cols = records[0]?.precipitation_5[0]?.length ?? 0;
  const frames: RadarFrame[] = records.map((r, i) => {
    const rate = new Float32Array(rows * cols);
    r.precipitation_5.forEach((row, ri) => row.forEach((v, ci) => (rate[ri * cols + ci] = toRate(v))));
    return {
      timestamp: r.timestamp,
      display: smooth(rate, rows, cols),
      isForecast: i > latestIndex,
      offsetMinutes: Math.round((new Date(r.timestamp).getTime() - latestMs) / 60000),
      rate,
    };
  });

  return {
    frames,
    rows,
    cols,
    cornersKm: res.geometry.coordinates.slice(0, 4).map(([lon, lat]) => toKm([lat, lon])),
    position: { row: res.latlon_position.y, col: res.latlon_position.x },
    latestIndex,
    latestObservation: records[latestIndex]?.timestamp ?? '',
  };
}

/** 3×3 binomial filter ([1 2 1] ⊗ [1 2 1]) with edge clamping. */
export function smooth(src: Float32Array, rows: number, cols: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const l = src[r * cols + Math.max(0, c - 1)];
      const m = src[r * cols + c];
      const rr = src[r * cols + Math.min(cols - 1, c + 1)];
      tmp[r * cols + c] = (l + 2 * m + rr) / 4;
    }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const u = tmp[Math.max(0, r - 1) * cols + c];
      const m = tmp[r * cols + c];
      const d = tmp[Math.min(rows - 1, r + 1) * cols + c];
      out[r * cols + c] = (u + 2 * m + d) / 4;
    }
  return out;
}

/** Bilinear sample of a rate grid at fractional (row, col); 0 outside. */
export function sample(rate: Float32Array, rows: number, cols: number, row: number, col: number): number {
  if (row < 0 || col < 0 || row > rows - 1 || col > cols - 1) return 0;
  const r0 = Math.floor(row);
  const c0 = Math.floor(col);
  const r1 = Math.min(rows - 1, r0 + 1);
  const c1 = Math.min(cols - 1, c0 + 1);
  const fr = row - r0;
  const fc = col - c0;
  const top = rate[r0 * cols + c0] * (1 - fc) + rate[r0 * cols + c1] * fc;
  const bottom = rate[r1 * cols + c0] * (1 - fc) + rate[r1 * cols + c1] * fc;
  return top * (1 - fr) + bottom * fr;
}

/**
 * Maps km coordinates to fractional grid (row, col). The clipped RADOLAN grid is
 * nearly affine at this extent, so an affine inverse from three corners suffices.
 */
export function kmToGrid(cornersKm: Km[], rows: number, cols: number) {
  const [tl, bl, , tr] = cornersKm;
  const ax = tr[0] - tl[0];
  const ay = tr[1] - tl[1];
  const bx = bl[0] - tl[0];
  const by = bl[1] - tl[1];
  const det = ax * by - ay * bx;
  return (x: number, y: number): [number, number] => {
    const dx = x - tl[0];
    const dy = y - tl[1];
    const u = (dx * by - dy * bx) / det;
    const v = (ax * dy - ay * dx) / det;
    return [v * rows - 0.5, u * cols - 0.5];
  };
}

/** Rate at the city centre (3×3 km mean), interpolated between frames at fractional index t. */
export function pointRateAt(data: RadarData, t: number): number {
  const k = Math.max(0, Math.min(data.frames.length - 1, Math.floor(t)));
  const k1 = Math.min(data.frames.length - 1, k + 1);
  const f = t - k;
  const at = (rate: Float32Array) => {
    let sum = 0;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        sum += sample(rate, data.rows, data.cols, data.position.row + dr, data.position.col + dc);
        n++;
      }
    return sum / n;
  };
  return at(data.frames[k].rate) * (1 - f) + at(data.frames[k1].rate) * f;
}

/** Continuous colour scale: [mm/h, r, g, b, alpha]. Interpolated on a log scale. */
export const RAIN_STOPS: [number, number, number, number, number][] = [
  [0.1, 140, 200, 255, 0],
  [0.25, 120, 185, 250, 0.45],
  [1, 45, 120, 230, 0.72],
  [3, 20, 160, 140, 0.8],
  [8, 235, 200, 40, 0.85],
  [20, 245, 120, 30, 0.9],
  [50, 200, 30, 90, 0.92],
];

export function rainColor(v: number): [number, number, number, number] | null {
  if (v < RAIN_STOPS[0][0]) return null;
  for (let i = 1; i < RAIN_STOPS.length; i++) {
    if (v <= RAIN_STOPS[i][0]) {
      const p = RAIN_STOPS[i - 1];
      const q = RAIN_STOPS[i];
      const f = (Math.log(v) - Math.log(p[0])) / (Math.log(q[0]) - Math.log(p[0]));
      return [p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f, p[3] + (q[3] - p[3]) * f, p[4] + (q[4] - p[4]) * f];
    }
  }
  const l = RAIN_STOPS[RAIN_STOPS.length - 1];
  return [l[1], l[2], l[3], l[4]];
}

export function rainCss(v: number, minAlpha = 0): string {
  const c = rainColor(v);
  if (!c) return 'transparent';
  return `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${Math.max(c[3], minAlpha)})`;
}

export function intensityText(rate: number): string {
  if (rate < 0.1) return 'trocken';
  if (rate < 0.5) return 'sehr leichter Regen';
  if (rate < 2.5) return 'leichter Regen';
  if (rate < 10) return 'mäßiger Regen';
  if (rate < 50) return 'starker Regen';
  return 'extremer Regen';
}
