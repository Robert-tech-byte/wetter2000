import { describe, expect, it } from 'vitest';
import { nowcastSentence } from './nowcast';
import type { RadarData } from './radar';

/** 3×3 grid, uniform rate per frame; frame 0 = latest observation at 14:00 UTC (15:00 Berlin). */
function data(rates: number[]): RadarData {
  return {
    rows: 3,
    cols: 3,
    cornersKm: [[-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5], [1.5, 1.5]],
    position: { row: 1, col: 1 },
    latestIndex: 0,
    latestObservation: '2026-11-17T14:00:00+00:00',
    frames: rates.map((v, i) => {
      const a = new Float32Array(9).fill(v);
      return {
        timestamp: new Date(Date.UTC(2026, 10, 17, 14, i * 5)).toISOString(),
        isForecast: i > 0,
        offsetMinutes: i * 5,
        rate: a,
        display: a,
      };
    }),
  };
}

describe('nowcastSentence', () => {
  it('dry hour', () => {
    expect(nowcastSentence(data(Array(13).fill(0)))).toBe('In der nächsten Stunde bleibt es trocken.');
  });
  it('rain starts later', () => {
    expect(nowcastSentence(data([0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]))).toBe('Leichter Regen ab etwa 15:20.');
  });
  it('rain stops', () => {
    expect(nowcastSentence(data([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('Leichter Regen, trocken ab etwa 15:10.');
  });
  it('pause and new rain', () => {
    expect(nowcastSentence(data([0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0]))).toBe(
      'Sehr leichter Regen bis etwa 15:05, ab 15:50 mäßiger Regen.',
    );
  });
  it('continuous rain', () => {
    expect(nowcastSentence(data(Array(13).fill(12)))).toBe('Starker Regen hält die nächste Stunde an.');
  });
});
