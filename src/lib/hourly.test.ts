import { describe, expect, it } from 'vitest';
import type { MemberSet } from './api';
import { iconFor, nextHours } from './hourly';

const time = Array.from({ length: 24 }, (_, h) => `2026-11-17T${String(h).padStart(2, '0')}:00`);
const member = (id: string, t: number, r: number, c: number) => ({
  id,
  label: id,
  temperature: time.map(() => t),
  precipitation: time.map(() => r),
  cloud: time.map(() => c),
});

describe('hourly', () => {
  it('icon rules', () => {
    expect(iconFor(0, 0, 10, 12, false)).toBe('sun');
    expect(iconFor(0, 0, 10, 12, true)).toBe('moon');
    expect(iconFor(0, 0, 50, 12, false)).toBe('partly');
    expect(iconFor(0.5, 0.8, 100, 12, false)).toBe('rain');
    expect(iconFor(0.5, 0.8, 100, -1, false)).toBe('snow');
  });

  it('12 hours of model medians starting at the current hour', () => {
    const set: MemberSet = { time, members: [member('a', 10, 0, 90), member('b', 12, 0.4, 90), member('c', 11, 0.2, 90)] };
    const cards = nextHours(set, '2026-11-17T08:00', null, null, 9.5);
    expect(cards).toHaveLength(13);
    expect(cards[0].label).toBe('Jetzt');
    expect(cards[0].temp).toBe(9.5);
    expect(cards[1].temp).toBe(11);
    expect(cards[1].rainProbability).toBeCloseTo(2 / 3);
    expect(cards[1].rainMm).toBeCloseTo(0.2);
    expect(cards[12].label).toBe('20 Uhr');
  });
});
