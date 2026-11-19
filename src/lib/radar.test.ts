import { describe, expect, it } from 'vitest';
import { kmToGrid, LUT_STEPS, RAIN_LUT, rainColor, sample, toRate } from './radar';

describe('radar', () => {
  it('bilinear sampling', () => {
    const g = new Float32Array([0, 2, 4, 6]);
    expect(sample(g, 2, 2, 0, 0)).toBe(0);
    expect(sample(g, 2, 2, 0.5, 0.5)).toBe(3);
    expect(sample(g, 2, 2, 5, 0)).toBe(0);
  });

  it('kmToGrid inverts an axis-aligned grid', () => {
    // 10×10 km grid centred at 0: TL(-5,5) BL(-5,-5) BR(5,-5) TR(5,5)
    const f = kmToGrid([[-5, 5], [-5, -5], [5, -5], [5, 5]], 10, 10);
    const [r, c] = f(0, 0);
    expect(r).toBeCloseTo(4.5);
    expect(c).toBeCloseTo(4.5);
    const [r2, c2] = f(-4.5, 4.5);
    expect(r2).toBeCloseTo(0);
    expect(c2).toBeCloseTo(0);
  });

  it('colour scale', () => {
    expect(rainColor(0.05)).toBeNull();
    expect(rainColor(1)?.[3]).toBeCloseTo(0.72);
    expect(rainColor(100)).not.toBeNull();
  });

  it('hides the two lowest DWD steps on the map', () => {
    const alpha = (v: number) => RAIN_LUT[Math.round(v * LUT_STEPS) * 4 + 3];
    expect(alpha(toRate(1))).toBe(0); // 0.12 mm/h
    expect(alpha(toRate(2))).toBe(0); // 0.24 mm/h
    expect(alpha(toRate(3))).toBeGreaterThan(80); // 0.36 mm/h
  });
});
