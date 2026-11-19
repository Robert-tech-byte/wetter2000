import { describe, expect, it } from 'vitest';
import type { ModelSeries } from './api';
import { pairDays } from './pair';

const day = (date: string, n = 24) => Array.from({ length: n }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);

function series(time: string[], temp: (h: number) => number | null, rain: (h: number) => number | null): ModelSeries {
  return { time, temperature: time.map((_, i) => temp(i)), precipitation: time.map((_, i) => rain(i)) };
}

describe('pairDays', () => {
  const time = [...day('2026-11-22'), ...day('2026-11-23')];

  it('agrees when both are close and dry', () => {
    const a = series(time, (i) => 5 + (i % 24) / 4, () => 0);
    const b = series(time, (i) => 5.5 + (i % 24) / 4, () => 0);
    const [d] = pairDays(a, b, ['2026-11-22']);
    expect(d.inTol).toBe(24);
    expect(d.level).toBe(3);
    expect(d.rainAgree).toBe(true);
  });

  it('weaker rating when only one model has rain and temperatures differ', () => {
    const a = series(time, () => 10, () => 0);
    const b = series(time, (i) => (i % 24 < 12 ? 10.5 : 14), (i) => (i % 24 === 15 ? 0.6 : 0));
    const [d] = pairDays(a, b, ['2026-11-22']);
    expect(d.inTol).toBe(12);
    expect(d.tempLevel).toBe(2);
    expect(d.rainLevel).toBe(1);
    expect(d.level).toBe(1);
    expect(d.other.tMax).toBe(14);
  });

  it('skips days the second model covers only partly', () => {
    const a = series(time, () => 5, () => 0);
    // ICON-EU ends at 10:00 on the 23rd
    const b = series(time, (i) => (i < 24 + 10 ? 5 : null), () => 0);
    expect(pairDays(a, b, ['2026-11-22', '2026-11-23']).map((d) => d.date)).toEqual(['2026-11-22']);
  });
});
