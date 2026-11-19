import { describe, expect, it } from 'vitest';
import { applyTransform, clampView, ZOOM_MAX_EXTENT, ZOOM_MIN_EXTENT } from '../components/RadarZoom';

const home = { cx: 0, cy: 0, extent: ZOOM_MAX_EXTENT };

describe('radar zoom', () => {
  it('zooming 2× around the centre halves the extent and keeps the centre', () => {
    const v = applyTransform(home, 400, 2, -200, -200);
    expect(v.extent).toBe(20);
    expect(v.cx).toBeCloseTo(0);
    expect(v.cy).toBeCloseTo(0);
  });

  it('zooming around the top right corner moves the centre north-east', () => {
    // point (400, 0) stays fixed: tx = 400 - 400·2, ty = 0
    const v = applyTransform(home, 400, 2, -400, 0);
    expect(v.extent).toBe(20);
    expect(v.cx).toBeCloseTo(20);
    expect(v.cy).toBeCloseTo(20);
  });

  it('dragging right moves the view west, clamped to the area', () => {
    const z = { cx: 0, cy: 0, extent: 10 };
    const v = applyTransform(z, 400, 1, 100, 0); // 100 px = 5 km
    expect(v.cx).toBeCloseTo(-5);
    expect(clampView({ cx: -100, cy: 0, extent: 10 }).cx).toBe(-30);
  });

  it('limits the zoom', () => {
    expect(clampView({ cx: 0, cy: 0, extent: 1 }).extent).toBe(ZOOM_MIN_EXTENT);
    expect(clampView({ cx: 5, cy: 5, extent: 80 })).toEqual(home);
  });
});
