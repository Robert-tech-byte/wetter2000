import { describe, expect, it } from 'vitest';
import { nextDays, trendSummary, type TrendData, type TrendDay } from './trend';
import fixtureJson from './__fixtures__/trend-2026-11-18.json';

const fixture = fixtureJson as TrendData;

const pct = (v: number, s = 1) => ({ p10: v - 2 * s, p25: v - s, p50: v, p75: v + s, p90: v + 2 * s });
// 2026-11-19 is a Thursday
const day = (i: number, max: number, min: number, prob: number): TrendDay => ({
  date: `2026-11-${String(19 + i).padStart(2, '0')}`,
  max: pct(max),
  min: pct(min),
  rain: { p50: prob > 0.5 ? 2 : 0, p90: 4, prob },
  members: 51,
});

describe('trend', () => {
  it('colder, frost and weekend rain', () => {
    const days = [10, 10, 10, 9, 5, 4, 4, 3, 3, 3, 3, 3, 3, 3].map((mx, i) =>
      day(i, mx, i >= 7 ? -2 : 2, [2, 3].includes(i) ? 0.8 : 0.2),
    );
    // i=2 → Sa 21.11., i=3 → So 22.11.
    expect(trendSummary(days)).toBe('Ab Montag deutlich kälter, Nachtfrost wahrscheinlich ab Donnerstag (26.11.). Regen vor allem am Wochenende.');
  });

  it('steady and dry', () => {
    const days = Array.from({ length: 14 }, (_, i) => day(i, 8, 3, 0.1));
    expect(trendSummary(days)).toBe('Temperaturen ohne große Änderung. Überwiegend trocken.');
  });

  it('real ECMWF ensemble of 18.11.2026', () => {
    const days = fixture.days.slice(1);
    expect(trendSummary(days)).toBe(
      'Ab Sonntag deutlich kälter, Nachtfrost wahrscheinlich ab Sonntag. Regen bis Montag, danach weiter wechselhaft.',
    );
  });

  it('rain stretch later, then dry', () => {
    const days = Array.from({ length: 14 }, (_, i) => day(i, 8, 3, i === 1 || i === 2 ? 0.9 : 0.1));
    expect(trendSummary(days)).toBe('Temperaturen ohne große Änderung. Regen von Freitag bis Samstag, danach überwiegend trocken.');
  });

  it('nextDays starts today', () => {
    const days = Array.from({ length: 16 }, (_, i) => day(i, 8, 3, 0.1));
    const n = nextDays({ source: '', model: '', generated: '', days }, '2026-11-19');
    expect(n[0].date).toBe('2026-11-19');
    expect(n).toHaveLength(15);
  });
});
