import { describe, expect, it } from 'vitest';
import { best, heading, isDry, modelOptions, radarOptions, route, windEffect } from './commute';
import type { RadarData } from './radar';

/** 40×40 km grid around 0, 1 km cells; rain function decides per frame and cell. */
function radar(rain: (frame: number, x: number, y: number) => number, frames = 13): RadarData {
  const n = 40;
  return {
    rows: n,
    cols: n,
    cornersKm: [[-20, 20], [-20, -20], [20, -20], [20, 20]],
    position: { row: 20, col: 20 },
    latestIndex: 0,
    latestObservation: '2026-11-17T14:00:00Z',
    frames: Array.from({ length: frames }, (_, f) => {
      const a = new Float32Array(n * n);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) a[r * n + c] = rain(f, c - 19.5, 19.5 - r);
      return { timestamp: '', isForecast: f > 0, offsetMinutes: f * 5, rate: a, display: a };
    }),
  };
}

const now = new Date('2026-11-17T14:00:00Z');

describe('commute', () => {
  it('route: home lies in the chosen direction from work, 20 km/h', () => {
    // Home 10 km east of work; "hin" goes home → work.
    const [a, b] = route([0, 0], 'O', 30, 'hin');
    expect(a[0]).toBeCloseTo(10);
    expect(a[1]).toBeCloseTo(0);
    expect(b).toEqual([0, 0]);
    // "heim" goes work → home (5 km north).
    const back = route([0, 0], 'N', 15, 'heim');
    expect(back[0]).toEqual([0, 0]);
    expect(back[1][1]).toBeCloseTo(5);
  });

  it('dry radar → leave now', () => {
    const opts = radarOptions(radar(() => 0), route([0, 0], 'O', 20, 'hin'), 20, now);
    expect(opts.length).toBe(9); // 0..40 min while trip ends within +60
    expect(isDry(opts[0])).toBe(true);
    expect(best(opts)?.depart).toBe(0);
  });

  it('rain now, dry later → suggests later departure', () => {
    // 2 mm/h everywhere for the first 30 minutes, then dry.
    const opts = radarOptions(radar((f) => (f < 6 ? 2 : 0)), route([0, 0], 'W', 10, 'hin'), 10, now);
    expect(isDry(opts[0])).toBe(false);
    expect(opts[0].mm).toBeCloseTo(2 / 6, 1);
    expect(best(opts)?.depart).toBe(30);
  });

  it('rain only east of the anchor → westward trip is dry', () => {
    const r = radar((_f, x) => (x > 2 ? 5 : 0));
    expect(isDry(radarOptions(r, route([0, 0], 'W', 30, 'hin'), 30, now)[0])).toBe(true);
    expect(isDry(radarOptions(r, route([0, 0], 'O', 30, 'hin'), 30, now)[0])).toBe(false);
  });

  it('model options from 15-minute sums', () => {
    const slots = Array.from({ length: 16 }, (_, i) => ({
      start: new Date(now.getTime() + i * 900000),
      mm15: i < 6 ? 0.5 : 0,
    }));
    const opts = modelOptions(slots, 30, now, 45);
    expect(opts[0].depart).toBe(45);
    expect(opts[0].mm).toBeCloseTo(1, 5); // 2 mm/h for 30 min
    expect(isDry(opts.find((o) => o.depart === 90)!)).toBe(true);
  });

  it('40-minute trip: radar covers departures up to +20 min', () => {
    const opts = radarOptions(radar(() => 0), route([0, 0], 'S', 40, 'hin'), 40, now);
    expect(opts.map((o) => o.depart)).toEqual([0, 5, 10, 15, 20]);
    const [home] = route([0, 0], 'S', 40, 'hin');
    expect(home[1]).toBeCloseTo(-40 / 3); // 13,3 km at 20 km/h
  });

  it('wind: heading and head/tail/cross components', () => {
    const north = route([0, 0], 'S', 20, 'hin'); // home in the south → riding north
    expect(Math.round(heading(north))).toBe(0);
    const slots = (dir: number, wind = 20, gust = 45) =>
      Array.from({ length: 8 }, (_, i) => ({ start: new Date(now.getTime() + i * 900000), mm15: 0, wind, windDir: dir, gust }));
    const head = windEffect(slots(0), north, now, 20)!;
    expect(head.kind).toBe('head');
    expect(Math.round(head.head)).toBe(20);
    expect(head.label).toMatch(/Gegenwind 20 km\/h, deutlich spürbar/);
    expect(head.deltaMin).toBeGreaterThan(0);
    expect(head.gust).toBe(45);
    const tail = windEffect(slots(180), north, now, 20)!;
    expect(tail.kind).toBe('tail');
    expect(tail.deltaMin).toBeLessThan(0);
    expect(windEffect(slots(90), north, now, 20)!.kind).toBe('cross');
    expect(windEffect(slots(90, 5), north, now, 20)!.kind).toBe('calm');
    expect(windEffect([], north, now, 20)).toBeNull();
  });
});
