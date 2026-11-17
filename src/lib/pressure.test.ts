import { describe, expect, it } from 'vitest';
import { extrema, isoline, upsample } from './pressure';

// 9×9 grid with a low in the centre (990) rising to ~1022 at the edges.
const lats = Array.from({ length: 9 }, (_, i) => 40 + i * 2.5);
const lons = Array.from({ length: 9 }, (_, j) => 0 + j * 2.5);
const grid = lats.map((_, i) => lons.map((_, j) => 990 + 1 * ((i - 4) ** 2 + (j - 4) ** 2)));

describe('pressure', () => {
  it('finds the low in the centre', () => {
    const e = extrema(grid, lats, lons);
    expect(e).toEqual([{ kind: 'T', lon: 10, lat: 50, value: 990 }]);
  });

  it('finds a high when inverted', () => {
    const inv = grid.map((r) => r.map((v) => 2020 - v));
    expect(extrema(inv, lats, lons)[0].kind).toBe('H');
  });

  it('isoline around the low is a closed ring of segments at the right distance', () => {
    const up = upsample(grid, lats, lons, 2);
    const segs = isoline(up.grid, up.lat, up.lon, 999); // r² = 9 → r = 3 cells = 7.5°
    expect(segs.length).toBeGreaterThan(8);
    for (const [a] of segs) {
      const r = Math.hypot(a[0] - 10, a[1] - 50);
      expect(r).toBeGreaterThan(6.5);
      expect(r).toBeLessThan(8.5);
    }
  });

  it('fills missing values', () => {
    const g = [[1000, null], [1000, 1002]];
    const up = upsample(g, [0, 1], [0, 1], 1);
    expect(up.grid[0][1]).toBe(1000);
  });
});
