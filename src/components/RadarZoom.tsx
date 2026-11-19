import { useCallback, useEffect, useRef, useState } from 'react';
import type { Km } from '../lib/geo';
import type { RadarData } from '../lib/radar';
import { RadarCanvas } from './RadarCanvas';

/** Largest view (half width, km) and the closest zoom; the radar resolves 1 km. */
export const ZOOM_MAX_EXTENT = 40;
export const ZOOM_MIN_EXTENT = 6;

export interface ZoomView {
  cx: number;
  cy: number;
  extent: number;
}

const HOME: ZoomView = { cx: 0, cy: 0, extent: ZOOM_MAX_EXTENT };

/** Keeps the view inside the ±40 km area and within the zoom limits. */
export function clampView(v: ZoomView): ZoomView {
  const extent = Math.max(ZOOM_MIN_EXTENT, Math.min(ZOOM_MAX_EXTENT, v.extent));
  const lim = ZOOM_MAX_EXTENT - extent;
  return { extent, cx: Math.max(-lim, Math.min(lim, v.cx)), cy: Math.max(-lim, Math.min(lim, v.cy)) };
}

/**
 * Applies a screen transform p' = p·s + (tx, ty) (CSS px, element of width `size`) to a view:
 * the new view shows what is visible after the transform.
 */
export function applyTransform(v: ZoomView, size: number, s: number, tx: number, ty: number): ZoomView {
  const kmPerPx = (2 * v.extent) / size;
  // Old-canvas pixel that ends up in the centre of the screen.
  const px = (size / 2 - tx) / s;
  const py = (size / 2 - ty) / s;
  return clampView({
    extent: v.extent / s,
    cx: v.cx - v.extent + px * kmPerPx,
    cy: v.cy + v.extent - py * kmPerPx,
  });
}

interface Props {
  data: RadarData | null;
  t: number;
  route?: Km[] | null;
}

interface Gesture {
  s: number;
  tx: number;
  ty: number;
}

/**
 * Large radar with zoom: pinch and drag (touch), wheel and double click (mouse), +/− buttons.
 * During a gesture the drawn image is moved with a CSS transform (instant feedback); when the
 * gesture ends the map and radar are redrawn sharply for the new view.
 */
export function RadarZoom({ data, t, route }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ZoomView>(HOME);
  const [g, setG] = useState<Gesture | null>(null);
  const gRef = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ g: Gesture; pts: { x: number; y: number }[] } | null>(null);
  const wheelTimer = useRef<number | undefined>(undefined);

  const size = () => box.current?.getBoundingClientRect().width ?? 1;
  const setGesture = (next: Gesture | null) => {
    gRef.current = next;
    setG(next);
  };

  const commit = useCallback(() => {
    const cur = gRef.current;
    if (!cur) return;
    setView((v) => applyTransform(v, size(), cur.s, cur.tx, cur.ty));
    setGesture(null);
  }, []);

  /** Zoom by factor k around a point (CSS px inside the box), committed immediately. */
  const zoomAt = (k: number, x: number, y: number) =>
    setView((v) => applyTransform(v, size(), k, x - x * k, y - y * k));

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const begin = () => {
    start.current = { g: gRef.current ?? { s: 1, tx: 0, ty: 0 }, pts: [...pointers.current.values()] };
  };

  const onDown = (e: React.PointerEvent) => {
    box.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    begin();
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !start.current) return;
    pointers.current.set(e.pointerId, local(e));
    const pts = [...pointers.current.values()];
    const st = start.current;
    if (pts.length === 1 && st.pts.length === 1) {
      setGesture({ s: st.g.s, tx: st.g.tx + pts[0].x - st.pts[0].x, ty: st.g.ty + pts[0].y - st.pts[0].y });
    } else if (pts.length >= 2 && st.pts.length >= 2) {
      const d0 = Math.hypot(st.pts[0].x - st.pts[1].x, st.pts[0].y - st.pts[1].y) || 1;
      const d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const m0 = { x: (st.pts[0].x + st.pts[1].x) / 2, y: (st.pts[0].y + st.pts[1].y) / 2 };
      const m1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const k = d1 / d0;
      setGesture({ s: st.g.s * k, tx: m1.x - (m0.x - st.g.tx) * k, ty: m1.y - (m0.y - st.g.ty) * k });
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      start.current = null;
      commit();
    } else begin();
  };

  // Wheel needs a non-passive listener to prevent page scrolling.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      const cur = gRef.current ?? { s: 1, tx: 0, ty: 0 };
      const k = Math.exp(-e.deltaY * 0.0025);
      setGesture({ s: cur.s * k, tx: p.x - (p.x - cur.tx) * k, ty: p.y - (p.y - cur.ty) * k });
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(commit, 180);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [commit]);

  const zoomed = view.extent < ZOOM_MAX_EXTENT - 0.01;
  const center = () => {
    const s = size();
    return [s / 2, s / 2] as const;
  };

  return (
    <div className="radar-zoom">
      <div
        ref={box}
        className="radar-frame big zoomable"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => {
          const p = local(e);
          zoomAt(2, p.x, p.y);
        }}
      >
        <div
          className="radar-move"
          style={g ? { transform: `translate(${g.tx}px, ${g.ty}px) scale(${g.s})` } : undefined}
        >
          <RadarCanvas
            data={data}
            t={t}
            extent={view.extent}
            center={[view.cx, view.cy]}
            route={route}
            label="Regenradar München und Umland, groß, zoombar"
          />
        </div>
      </div>
      <div className="zoom-buttons" role="group" aria-label="Zoom">
        <button type="button" className="round" aria-label="Vergrößern" disabled={view.extent <= ZOOM_MIN_EXTENT + 0.01} onClick={() => zoomAt(1.6, ...center())}>
          +
        </button>
        <button type="button" className="round" aria-label="Verkleinern" disabled={!zoomed} onClick={() => zoomAt(1 / 1.6, ...center())}>
          −
        </button>
        {zoomed && (
          <button type="button" className="round wide" aria-label="Ansicht zurücksetzen" onClick={() => setView(HOME)}>
            ±{ZOOM_MAX_EXTENT} km
          </button>
        )}
      </div>
    </div>
  );
}
