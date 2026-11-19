import { useEffect, useMemo, useRef, useState } from 'react';
import { drawOver, drawUnder, type MapColors, type View } from '../lib/basemap';
import type { Km } from '../lib/geo';
import { kmToGrid, LUT_STEPS, RAIN_LUT, smooth, type RadarData } from '../lib/radar';
import { useThemeColors } from '../lib/useThemeColors';

export type Softness = 'soft' | 'softer';

interface Props {
  data: RadarData | null;
  /** Fractional frame index; frames are cross-faded in between. */
  t: number;
  /** Half width of the shown area in km. */
  extent: number;
  /** Half height in km (default: same as extent, i.e. square). */
  extentY?: number;
  /** Centre of the view in km from Munich (default 0, 0). */
  center?: Km;
  label: string;
  route?: Km[] | null;
  /**
   * soft: rain rate interpolated smoothly between the 1-km radar cells (no visible blocks).
   * softer: additionally a light 3×3 blur over neighbouring cells.
   */
  softness?: Softness;
}

function makeCanvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const LUT_MAX = RAIN_LUT.length / 4 - 1;

/**
 * Draws the map and the DWD radar. Every screen pixel looks up its exact position in the radar
 * grid (no seams) and reads the rain rate interpolated between the surrounding 1-km cells.
 */
export function RadarCanvas({ data, t, extent, extentY = extent, center, label, route, softness = 'soft' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useThemeColors();
  const [size, setSize] = useState(0);
  const cx = center?.[0] ?? 0;
  const cy = center?.[1] ?? 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colors: MapColors = useMemo(
    () => ({
      land: theme['--map-land'],
      water: theme['--map-water'],
      city: theme['--map-city'],
      road: theme['--map-road'],
      line: theme['--map-ring'],
      label: theme['--muted'],
      strong: theme['--fg'],
      river: theme['--map-water'],
    }),
    [theme],
  );

  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);

  const height = Math.round((size * extentY) / extent);

  const layers = useMemo(() => {
    if (!size) return null;
    const px = Math.round(size * dpr);
    const pxH = Math.round(height * dpr);
    const view: View = { size, height, extent, cx, cy };
    const under = makeCanvas(px, pxH);
    const over = makeCanvas(px, pxH);
    const u = under.getContext('2d')!;
    const o = over.getContext('2d')!;
    u.scale(dpr, dpr);
    o.scale(dpr, dpr);
    drawUnder(u, view, colors);
    drawOver(o, view, colors, route);
    return { under, over, px, pxH };
  }, [size, height, extent, cx, cy, colors, route, dpr]);

  /** Rain layer resolution: one texel per CSS pixel. */
  const res = size || 1;
  const resH = height || 1;

  /** Fractional radar grid position (row, col) for every texel; NaN outside the grid. */
  const lookup = useMemo(() => {
    if (!data || !size) return null;
    const toGrid = kmToGrid(data.cornersKm, data.rows, data.cols);
    const pos = new Float32Array(res * resH * 2);
    const kmPerPx = (2 * extent) / res;
    for (let py = 0; py < resH; py++)
      for (let px = 0; px < res; px++) {
        const x = cx + (px + 0.5 - res / 2) * kmPerPx;
        const y = cy - (py + 0.5 - resH / 2) * kmPerPx;
        const [r, c] = toGrid(x, y);
        const i = (py * res + px) * 2;
        const inside = r >= -0.5 && c >= -0.5 && r <= data.rows - 0.5 && c <= data.cols - 0.5;
        pos[i] = inside ? Math.max(0, Math.min(data.rows - 1, r)) : NaN;
        pos[i + 1] = inside ? Math.max(0, Math.min(data.cols - 1, c)) : NaN;
      }
    return pos;
  }, [data, extent, cx, cy, res, resH, size]);

  const rainCanvas = useMemo(() => makeCanvas(res, resH), [res, resH]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !layers) return;
    if (canvas.width !== layers.px || canvas.height !== layers.pxH) {
      canvas.width = layers.px;
      canvas.height = layers.pxH;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layers.under, 0, 0);

    if (data && lookup && data.frames.length) {
      const { rows, cols } = data;
      const k = Math.max(0, Math.min(data.frames.length - 1, Math.floor(t)));
      const k1 = Math.min(data.frames.length - 1, k + 1);
      const f = Math.max(0, Math.min(1, t - k));
      const a = data.frames[k].rate;
      const b = data.frames[k1].rate;
      let g: Float32Array = new Float32Array(a.length);
      for (let i = 0; i < g.length; i++) g[i] = a[i] * (1 - f) + b[i] * f;
      if (softness === 'softer') g = smooth(g, rows, cols);

      const rc = rainCanvas.getContext('2d')!;
      const img = rc.createImageData(res, resH);
      const d = img.data;
      for (let i = 0, n = res * resH; i < n; i++) {
        const r = lookup[i * 2];
        if (r !== r) continue; // NaN: outside the radar grid
        const c = lookup[i * 2 + 1];
        const r0 = r | 0;
        const c0 = c | 0;
        const r1 = r0 + 1 < rows ? r0 + 1 : r0;
        const c1 = c0 + 1 < cols ? c0 + 1 : c0;
        const fr = r - r0;
        const fc = c - c0;
        const top = g[r0 * cols + c0] * (1 - fc) + g[r0 * cols + c1] * fc;
        const bot = g[r1 * cols + c0] * (1 - fc) + g[r1 * cols + c1] * fc;
        const v = top * (1 - fr) + bot * fr;
        let li = Math.round(v * LUT_STEPS);
        if (li <= 0) continue;
        if (li > LUT_MAX) li = LUT_MAX;
        const alpha = RAIN_LUT[li * 4 + 3];
        if (!alpha) continue;
        const o = i * 4;
        d[o] = RAIN_LUT[li * 4];
        d[o + 1] = RAIN_LUT[li * 4 + 1];
        d[o + 2] = RAIN_LUT[li * 4 + 2];
        d[o + 3] = alpha;
      }
      rc.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(rainCanvas, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    ctx.drawImage(layers.over, 0, 0);
  }, [data, lookup, layers, t, rainCanvas, res, resH, softness]);

  return <canvas ref={ref} className="radar-canvas" role="img" aria-label={label} />;
}
