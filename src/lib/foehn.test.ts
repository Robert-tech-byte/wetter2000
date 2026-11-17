import { describe, expect, it } from 'vitest';
import type { FoehnSeries } from './api';
import { analyzeFoehn } from './foehn';

const time = Array.from({ length: 48 }, (_, i) => `2026-11-${i < 24 ? '18' : '19'}T${String(i % 24).padStart(2, '0')}:00`);
const series = (p: (i: number) => number, rh?: (i: number) => number, dir?: (i: number) => number): FoehnSeries => ({
  time,
  pressure: time.map((_, i) => p(i)),
  humidity: rh ? time.map((_, i) => rh(i)) : undefined,
  dir700: dir ? time.map((_, i) => dir(i)) : undefined,
});

describe('foehn', () => {
  it('detects Föhn when all criteria hold on day 1 only', () => {
    const munich = series(() => 1010, (i) => (i < 24 ? 40 : 80), () => 200);
    const bozen = series((i) => (i < 24 ? 1017 : 1012));
    const [d1, d2] = analyzeFoehn(munich, bozen);
    expect(d1.active).toBe(true);
    expect(d1.maxDiff).toBe(7);
    expect(d1.minHumidity).toBe(40);
    expect(d2.active).toBe(false);
  });

  it('northerly upper wind blocks the signal', () => {
    const munich = series(() => 1010, () => 40, () => 350);
    const bozen = series(() => 1017);
    expect(analyzeFoehn(munich, bozen)[0].active).toBe(false);
  });

  it('humid air blocks the signal', () => {
    const munich = series(() => 1010, () => 75, () => 190);
    expect(analyzeFoehn(munich, series(() => 1017))[0].active).toBe(false);
  });

  it('without upper-level wind, pressure + humidity decide', () => {
    const munich = series(() => 1010, () => 40);
    const [d] = analyzeFoehn(munich, series(() => 1016));
    expect(d.active).toBe(true);
    expect(d.withUpperWind).toBe(false);
  });

  it('night hours are ignored', () => {
    const munich = series(() => 1010, () => 40, () => 190);
    const bozen = series((i) => (i % 24 < 5 ? 1020 : 1011));
    expect(analyzeFoehn(munich, bozen)[0].active).toBe(false);
  });
});
