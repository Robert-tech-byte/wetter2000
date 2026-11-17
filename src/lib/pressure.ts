/** Europe sea-level pressure (built every 6 h by scripts/build-pressure.py). */
export interface PressureData {
  source: string;
  model: string;
  generated: string;
  lats: number[];
  lons: number[];
  days: { date: string; p: (number | null)[][] }[];
}

export type Pt = [number, number]; // [lon, lat]

/** Bilinear up-sampling of a grid (nulls are filled with the nearest valid neighbour first). */
export function upsample(grid: (number | null)[][], lats: number[], lons: number[], f: number) {
  const rows = grid.length;
  const cols = grid[0].length;
  const filled = grid.map((r) => r.slice());
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++)
      if (filled[i][j] == null) {
        let best: number | null = null;
        let bd = Infinity;
        for (let a = 0; a < rows; a++)
          for (let b = 0; b < cols; b++) {
            const v = grid[a][b];
            const d = (a - i) ** 2 + (b - j) ** 2;
            if (v != null && d < bd) {
              bd = d;
              best = v;
            }
          }
        filled[i][j] = best ?? 1013;
      }
  const R = (rows - 1) * f + 1;
  const C = (cols - 1) * f + 1;
  const out: number[][] = [];
  for (let i = 0; i < R; i++) {
    const fi = i / f;
    const i0 = Math.min(rows - 2, Math.floor(fi));
    const ti = fi - i0;
    const row: number[] = [];
    for (let j = 0; j < C; j++) {
      const fj = j / f;
      const j0 = Math.min(cols - 2, Math.floor(fj));
      const tj = fj - j0;
      const a = filled[i0][j0]!;
      const b = filled[i0][j0 + 1]!;
      const c = filled[i0 + 1][j0]!;
      const d = filled[i0 + 1][j0 + 1]!;
      row.push((a * (1 - tj) + b * tj) * (1 - ti) + (c * (1 - tj) + d * tj) * ti);
    }
    out.push(row);
  }
  const lat = (i: number) => lats[0] + ((lats[lats.length - 1] - lats[0]) * i) / (R - 1);
  const lon = (j: number) => lons[0] + ((lons[lons.length - 1] - lons[0]) * j) / (C - 1);
  return { grid: out, lat, lon };
}

/** Marching squares: line segments of the isoline `level` (in lon/lat). */
export function isoline(grid: number[][], lat: (i: number) => number, lon: (j: number) => number, level: number): [Pt, Pt][] {
  const segs: [Pt, Pt][] = [];
  const interp = (i1: number, j1: number, i2: number, j2: number): Pt => {
    const v1 = grid[i1][j1];
    const v2 = grid[i2][j2];
    const t = v1 === v2 ? 0.5 : (level - v1) / (v2 - v1);
    return [lon(j1 + (j2 - j1) * t), lat(i1 + (i2 - i1) * t)];
  };
  for (let i = 0; i < grid.length - 1; i++)
    for (let j = 0; j < grid[0].length - 1; j++) {
      const a = grid[i][j] >= level ? 1 : 0;
      const b = grid[i][j + 1] >= level ? 1 : 0;
      const c = grid[i + 1][j + 1] >= level ? 1 : 0;
      const d = grid[i + 1][j] >= level ? 1 : 0;
      const code = a * 8 + b * 4 + c * 2 + d;
      if (code === 0 || code === 15) continue;
      const top = () => interp(i, j, i, j + 1);
      const right = () => interp(i, j + 1, i + 1, j + 1);
      const bottom = () => interp(i + 1, j, i + 1, j + 1);
      const left = () => interp(i, j, i + 1, j);
      switch (code) {
        case 1: case 14: segs.push([left(), bottom()]); break;
        case 2: case 13: segs.push([bottom(), right()]); break;
        case 3: case 12: segs.push([left(), right()]); break;
        case 4: case 11: segs.push([top(), right()]); break;
        case 6: case 9: segs.push([top(), bottom()]); break;
        case 7: case 8: segs.push([left(), top()]); break;
        case 5: segs.push([left(), top()], [bottom(), right()]); break;
        case 10: segs.push([top(), right()], [left(), bottom()]); break;
      }
    }
  return segs;
}

export interface Extremum {
  kind: 'H' | 'T';
  lon: number;
  lat: number;
  value: number;
}

/** Highs and lows: strict local extrema within `radius` cells that stand out from their surroundings. */
export function extrema(grid: (number | null)[][], lats: number[], lons: number[], radius = 3, minDiff = 2): Extremum[] {
  const out: Extremum[] = [];
  const rows = grid.length;
  const cols = grid[0].length;
  for (let i = 1; i < rows - 1; i++)
    for (let j = 1; j < cols - 1; j++) {
      const v = grid[i][j];
      if (v == null) continue;
      let isMax = true;
      let isMin = true;
      let sum = 0;
      let n = 0;
      for (let a = Math.max(0, i - radius); a <= Math.min(rows - 1, i + radius); a++)
        for (let b = Math.max(0, j - radius); b <= Math.min(cols - 1, j + radius); b++) {
          if (a === i && b === j) continue;
          const w = grid[a][b];
          if (w == null) continue;
          if (w >= v) isMax = false;
          if (w <= v) isMin = false;
          sum += w;
          n++;
        }
      if (!n) continue;
      const mean = sum / n;
      if (isMax && v - mean >= minDiff) out.push({ kind: 'H', lon: lons[j], lat: lats[i], value: v });
      if (isMin && mean - v >= minDiff) out.push({ kind: 'T', lon: lons[j], lat: lats[i], value: v });
    }
  return out;
}
