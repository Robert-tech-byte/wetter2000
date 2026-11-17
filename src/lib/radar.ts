import type { RadarResponse } from './api';

export interface RadarFrame {
  timestamp: string;
  /** Run (observation) time this frame belongs to. */
  runTime: string;
  isForecast: boolean;
  /** Minutes after the latest observation (0 for observed frames). */
  leadMinutes: number;
  /** Precipitation rate in mm/h, row-major [row][col], row 0 = north. */
  rate: number[][];
}

export interface RadarData {
  frames: RadarFrame[];
  /** Corners [lat, lon]: top-left, bottom-left, bottom-right, top-right. */
  corners: [number, number][];
  rows: number;
  cols: number;
  /** Fractional grid position of the requested location. */
  position: { row: number; col: number };
  latestObservation: string;
}

/** Bright Sky delivers 0.01 mm per 5 minutes → mm/h. */
export const toRate = (raw: number) => (raw / 100) * 12;

export function parseRadar(res: RadarResponse): RadarData {
  const records = [...res.radar].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const runOf = (source: string) => source.split('::').pop() ?? '';
  // Latest observed frame: its timestamp equals the run time in `source`.
  const observed = records.filter((r) => new Date(runOf(r.source)).getTime() === new Date(r.timestamp).getTime());
  const latestObservation = (observed.at(-1) ?? records[0]).timestamp;
  const latestMs = new Date(latestObservation).getTime();

  const frames: RadarFrame[] = records.map((r) => {
    const ts = new Date(r.timestamp).getTime();
    const runTime = runOf(r.source);
    const isForecast = ts > new Date(runTime).getTime();
    return {
      timestamp: r.timestamp,
      runTime,
      isForecast,
      leadMinutes: Math.max(0, Math.round((ts - latestMs) / 60000)),
      rate: r.precipitation_5.map((row) => row.map(toRate)),
    };
  });

  const rows = records[0]?.precipitation_5.length ?? 0;
  const cols = records[0]?.precipitation_5[0]?.length ?? 0;
  return {
    frames,
    corners: res.geometry.coordinates.slice(0, 4).map(([lon, lat]) => [lat, lon] as [number, number]),
    rows,
    cols,
    position: { row: res.latlon_position.y, col: res.latlon_position.x },
    latestObservation,
  };
}

/**
 * Lat/lon of a grid-cell corner by bilinear interpolation between the four corners
 * of the clipped RADOLAN grid (accurate to well below 1 km at this extent).
 */
export function gridToLatLon(corners: [number, number][], u: number, v: number): [number, number] {
  const [tl, bl, br, tr] = corners;
  const top: [number, number] = [tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u];
  const bottom: [number, number] = [bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u];
  return [top[0] + (bottom[0] - top[0]) * v, top[1] + (bottom[1] - top[1]) * v];
}

/** Mean rate (mm/h) in a 3×3 km box around the location. */
export function pointRate(frame: RadarFrame, pos: { row: number; col: number }): number {
  const r0 = Math.round(pos.row);
  const c0 = Math.round(pos.col);
  let sum = 0;
  let n = 0;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    for (let c = c0 - 1; c <= c0 + 1; c++) {
      const v = frame.rate[r]?.[c];
      if (typeof v === 'number') {
        sum += v;
        n++;
      }
    }
  }
  return n ? sum / n : 0;
}

/** Colour scale (mm/h). */
export const RAIN_SCALE: { min: number; color: string; label: string }[] = [
  { min: 0.1, color: 'rgba(120, 200, 255, 0.55)', label: '0,1' },
  { min: 0.5, color: 'rgba(60, 150, 245, 0.7)', label: '0,5' },
  { min: 1, color: 'rgba(30, 90, 220, 0.75)', label: '1' },
  { min: 2, color: 'rgba(20, 170, 80, 0.8)', label: '2' },
  { min: 5, color: 'rgba(240, 210, 0, 0.85)', label: '5' },
  { min: 10, color: 'rgba(250, 130, 0, 0.9)', label: '10' },
  { min: 20, color: 'rgba(225, 30, 30, 0.9)', label: '20' },
  { min: 50, color: 'rgba(170, 0, 170, 0.9)', label: '50' },
];

export function rateColor(rate: number): string | null {
  let color: string | null = null;
  for (const step of RAIN_SCALE) if (rate >= step.min) color = step.color;
  return color;
}

export function intensityText(rate: number): string {
  if (rate < 0.1) return 'trocken';
  if (rate < 0.5) return 'sehr leicht';
  if (rate < 2.5) return 'leicht';
  if (rate < 10) return 'mäßig';
  if (rate < 50) return 'stark';
  return 'extrem';
}
