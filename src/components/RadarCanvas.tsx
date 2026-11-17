import { useEffect, useMemo, useRef, useState } from 'react';
import { drawOver, drawUnder, type MapColors, type View } from '../lib/basemap';
import type { Km } from '../lib/geo';
import { kmToGrid, rainColor, type RadarData } from '../lib/radar';
import { useThemeColors } from '../lib/useThemeColors';

interface Props {
  data: RadarData | null;
  /** Fractional frame index; frames are cross-faded in between. */
  t: number;
  /** Half width of the shown square in km. */
  extent: number;
  label: string;
  route?: Km[] | null;
}

function makeCanvas(w: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = w;
  return c;
}

/**
 * Draws the map and the DWD radar as 1-km blocks. Every screen pixel looks up the radar
 * cell it lies in (exact projection, no seams); blocks keep their crisp edges.
 */
export function RadarCanvas({ data, t, extent, label, route }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const theme = useThemeColors();
  const [size, setSize] = useState(0);

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

  const layers = useMemo(() => {
    if (!size) return null;
    const px = Math.round(size * dpr);
    const view: View = { size, extent };
    const under = makeCanvas(px);
    const over = makeCanvas(px);
    const u = under.getContext('2d')!;
    const o = over.getContext('2d')!;
    u.scale(dpr, dpr);
    o.scale(dpr, dpr);
    drawUnder(u, view, colors);
    drawOver(o, view, colors, route);
    return { under, over, px };
  }, [size, extent, colors, route, dpr]);

  /** Rain layer resolution: one texel per CSS pixel. */
  const res = size || 1;

  /** Radar cell index for every texel (-1 = outside the radar grid). */
  const lookup = useMemo(() => {
    if (!data || !size) return null;
    const toGrid = kmToGrid(data.cornersKm, data.rows, data.cols);
    const idx = new Int32Array(res * res);
    for (let py = 0; py < res; py++)
      for (let px = 0; px < res; px++) {
        const x = ((px + 0.5) / res) * 2 * extent - extent;
        const y = extent - ((py + 0.5) / res) * 2 * extent;
        const [r, c] = toGrid(x, y);
        const ri = Math.round(r);
        const ci = Math.round(c);
        idx[py * res + px] = ri < 0 || ci < 0 || ri >= data.rows || ci >= data.cols ? -1 : ri * data.cols + ci;
      }
    return idx;
  }, [data, extent, res, size]);

  const rainCanvas = useMemo(() => makeCanvas(res), [res]);

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
      const a = data.frames[k].rate;
      const b = data.frames[k1].rate;
      // Colour per radar cell once, then paint texels.
      const cellColor = new Map<number, [number, number, number, number] | null>();
      const rc = rainCanvas.getContext('2d')!;
      const img = rc.createImageData(res, res);
      const d = img.data;
      for (let i = 0; i < lookup.length; i++) {
        const cell = lookup[i];
        if (cell < 0) continue;
        let col = cellColor.get(cell);
        if (col === undefined) {
          col = rainColor(a[cell] * (1 - f) + b[cell] * f);
          cellColor.set(cell, col);
        }
        if (!col) continue;
        const o = i * 4;
        d[o] = col[0];
        d[o + 1] = col[1];
        d[o + 2] = col[2];
        d[o + 3] = Math.max(col[3], 0.35) * 255;
      }
      rc.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(rainCanvas, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    ctx.drawImage(layers.over, 0, 0);
  }, [data, lookup, layers, t, rainCanvas, res]);

  return <canvas ref={ref} className="radar-canvas" role="img" aria-label={label} />;
}
