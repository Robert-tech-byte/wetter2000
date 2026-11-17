import { describe, expect, it } from 'vitest';
import { analyzeDays, dayAgreement, median, rainConsensus, type Member } from './agreement';

const time = Array.from({ length: 48 }, (_, i) => {
  const d = i < 24 ? '2026-11-17' : '2026-11-18';
  return `${d}T${String(i % 24).padStart(2, '0')}:00`;
});

function member(id: string, temp: number, rain: number, validHours = 48): Member {
  return {
    id,
    label: id,
    temperature: time.map((_, i) => (i < validHours ? temp : null)),
    precipitation: time.map((_, i) => (i < validHours ? rain : null)),
  };
}

describe('agreement', () => {
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it('counts members within ±1.5 °C of the median', () => {
    const members = [member('a', 10, 0), member('b', 11, 0), member('c', 10.5, 0), member('d', 14, 0)];
    const day = dayAgreement(time, members, 0, 24);
    expect(day.members).toHaveLength(4);
    expect(day.tempAgreement).toBeCloseTo(0.75);
  });

  it('rain probability = share of members with an hour ≥ 0.1 mm', () => {
    const members = [member('a', 10, 0.2), member('b', 10, 0), member('c', 10, 0.05), member('d', 10, 0.1)];
    const day = dayAgreement(time, members, 0, 24);
    expect(day.rainProbability).toBe(0.5);
    expect(day.rainMembers).toBe(2);
    expect(rainConsensus(0.5)).toBe(0.5);
    expect(rainConsensus(0.1)).toBe(0.9);
  });

  it('drops members that cover too few hours of a day', () => {
    const members = [member('a', 10, 0), member('b', 10, 0), member('short', 20, 5, 30)];
    const [d1, d2] = analyzeDays(time, members, '2026-11-17T00:00', 2);
    expect(d1.members).toHaveLength(3);
    expect(d2.members.map((m) => m.id)).toEqual(['a', 'b']);
    expect(d2.tempAgreement).toBe(1);
  });

  it('only evaluates the remaining hours of today', () => {
    const members = [member('a', 10, 0), member('b', 12, 0)];
    const [today] = analyzeDays(time, members, '2026-11-17T20:00', 1);
    expect(today.hours).toBe(4);
  });
});
