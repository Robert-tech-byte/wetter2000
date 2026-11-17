import { useEffect, useMemo, useRef, useState } from 'react';
import { drawOver, drawUnder, type MapColors, type View } from '../lib/basemap';
import { kmToGrid, rainColor, sample, type RadarData } from '../lib/radar';
import { useThemeColors } from '../lib/useThemeColors';

interface Props {
  data: RadarData | null;
  /** Fractional frame index; frames are cross-faded in between. */
  t: number;
  /** Half width of the shown square in km. */
  extent: number;
  label: string;
}


function makeCanvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function RadarCanvas({ data, t, extent, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  /** Off-screen resolution of the rain field (≈ 2–3 px per km) before smooth up-scaling. */
  const RAIN_RES = extent > 45 ? 360 : 240;
  const theme = useThemeColors();
  const [size, setSize] = useState(0);

  // Track the rendered size.
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

  // Cached map layers, re-drawn only when size or theme change.
  const layers = useMemo(() => {
    if (!size) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    const view: View = { size, extent };
    const under = makeCanvas(px);
    const over = makeCanvas(px);
    const u = under.getContext('2d')!;
    const o = over.getContext('2d')!;
    u.scale(dpr, dpr);
    o.scale(dpr, dpr);
    drawUnder(u, view, colors);
    drawOver(o, view, colors);
    return { under, over, px };
  }, [size, extent, colors]);

  // Pre-computed mapping from off-screen pixels to radar grid positions.
  const lookup = useMemo(() => {
    if (!data) return null;
    const toGrid = kmToGrid(data.cornersKm, data.rows, data.cols);
    const rows = new Float32Array(RAIN_RES * RAIN_RES);
    const cols = new Float32Array(RAIN_RES * RAIN_RES);
    for (let py = 0; py < RAIN_RES; py++)
      for (let pxl = 0; pxl < RAIN_RES; pxl++) {
        const x = ((pxl + 0.5) / RAIN_RES) * 2 * extent - extent;
        const y = extent - ((py + 0.5) / RAIN_RES) * 2 * extent;
        const [r, c] = toGrid(x, y);
        rows[py * RAIN_RES + pxl] = r;
        cols[py * RAIN_RES + pxl] = c;
      }
    return { rows, cols };
  }, [data, extent, RAIN_RES]);

  const rainCanvas = useMemo(() => makeCanvas(RAIN_RES), [RAIN_RES]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !layers) return;
    if (canvas.width !== layers.px) {
      canvas.width = layers.px;
      canvas.height = layers.px;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layers.under, 0, 0);

    if (data && lookup && data.frames.length) {
      const k = Math.max(0, Math.min(data.frames.length - 1, Math.floor(t)));
      const k1 = Math.min(data.frames.length - 1, k + 1);
      const f = Math.max(0, Math.min(1, t - k));
      const a = data.frames[k].display;
      const b = data.frames[k1].display;
      const rc = rainCanvas.getContext('2d')!;
      const img = rc.createImageData(RAIN_RES, RAIN_RES);
      const d = img.data;
      for (let i = 0; i < RAIN_RES * RAIN_RES; i++) {
        const r = lookup.rows[i];
        const c = lookup.cols[i];
        const va = sample(a, data.rows, data.cols, r, c);
        const v = f > 0 ? va * (1 - f) + sample(b, data.rows, data.cols, r, c) * f : va;
        const col = rainColor(v);
        if (!col) continue;
        const o = i * 4;
        d[o] = col[0];
        d[o + 1] = col[1];
        d[o + 2] = col[2];
        d[o + 3] = col[3] * 255;
      }
      rc.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = 'blur(1px)';
      ctx.drawImage(rainCanvas, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    ctx.drawImage(layers.over, 0, 0);
  }, [data, lookup, layers, t, rainCanvas, RAIN_RES]);

  return <canvas ref={ref} className="radar-canvas" role="img" aria-label={label} />;
}
