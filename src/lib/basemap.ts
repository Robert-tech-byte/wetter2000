import data from '../data/basemap.json';
import { toKm, type Km, type LatLon } from './geo';

/**
 * Simplified geodata for Munich and surroundings (© OpenStreetMap contributors, ODbL).
 * Generated once by scripts/build-basemap.py.
 */
interface RawBasemap {
  city: LatLon[][];
  isar: LatLon[][];
  lakes: LatLon[][];
  motorways: { ref: string; lines: LatLon[][] }[];
  roads?: LatLon[][];
  places: { name: string; lat: number; lon: number }[];
  suburbs?: { name: string; lat: number; lon: number }[];
  anchor?: { name: string; lat: number; lon: number };
}

const raw = data as unknown as RawBasemap;
const proj = (lines: LatLon[][]) => lines.map((l) => l.map(toKm));

export const BASEMAP = {
  city: proj(raw.city),
  isar: proj(raw.isar),
  lakes: proj(raw.lakes),
  motorways: raw.motorways.map((m) => ({ ref: m.ref, lines: proj(m.lines) })),
  roads: proj(raw.roads ?? []),
  places: raw.places.map((p) => ({ name: p.name, at: toKm([p.lat, p.lon]) as Km })),
  suburbs: (raw.suburbs ?? []).map((p) => ({ name: p.name, at: toKm([p.lat, p.lon]) as Km })),
};

/** U-Bahn Schwanthalerhöhe – reference point for the commute check (fallback: approx. position). */
export const ANCHOR: { name: string; at: Km; lat: number; lon: number } = (() => {
  const a = raw.anchor ?? { name: 'U Schwanthalerhöhe', lat: 48.1336, lon: 11.5403 };
  return { ...a, at: toKm([a.lat, a.lon]) };
})();

export interface MapColors {
  land: string;
  water: string;
  city: string;
  road: string;
  line: string;
  label: string;
  strong: string;
  river: string;
}

export interface View {
  size: number;
  /** Half width of the shown square in km. */
  extent: number;
}

export function projector({ size, extent }: View) {
  return ([x, y]: Km): [number, number] => [((x + extent) / (2 * extent)) * size, ((extent - y) / (2 * extent)) * size];
}

function trace(ctx: CanvasRenderingContext2D, line: Km[], px: (p: Km) => [number, number]) {
  line.forEach((p, i) => {
    const [x, y] = px(p);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
}

/** Layer below the rain: land, lakes, city area, motorways. */
export function drawUnder(ctx: CanvasRenderingContext2D, view: View, c: MapColors) {
  const px = projector(view);
  ctx.fillStyle = c.land;
  ctx.fillRect(0, 0, view.size, view.size);

  ctx.fillStyle = c.water;
  ctx.beginPath();
  for (const lake of BASEMAP.lakes) {
    trace(ctx, lake, px);
    ctx.closePath();
  }
  ctx.fill('evenodd');

  ctx.fillStyle = c.city;
  ctx.beginPath();
  for (const ring of BASEMAP.city) {
    trace(ctx, ring, px);
    ctx.closePath();
  }
  ctx.fill('evenodd');

  const zoomed = view.extent <= 25;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (zoomed) {
    ctx.strokeStyle = c.road;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const l of BASEMAP.roads) trace(ctx, l, px);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = c.road;
  ctx.lineWidth = zoomed ? 1.8 : view.size > 500 ? 1.4 : 1.1;
  ctx.beginPath();
  for (const m of BASEMAP.motorways) for (const l of m.lines) trace(ctx, l, px);
  ctx.stroke();
}

/** Layer above the rain: Isar, city outline, distance rings, places. Keeps orientation readable. */
export function drawOver(ctx: CanvasRenderingContext2D, view: View, c: MapColors, route?: Km[] | null) {
  const px = projector(view);
  const scale = view.size / (2 * view.extent);
  const small = view.size < 420;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = c.river;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const l of BASEMAP.isar) trace(ctx, l, px);
  ctx.stroke();

  ctx.strokeStyle = c.strong;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const ring of BASEMAP.city) {
    trace(ctx, ring, px);
    ctx.closePath();
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  const [cx, cy] = px([0, 0]);
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  const rings = view.extent <= 20 ? [5, 10] : view.extent > 45 ? [10, 25, 50] : [10, 25];
  for (const r of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const label = (text: string, x: number, y: number, weight: number, size: number, color: string) => {
    ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.land;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  // Ring labels sit due south-west, where no place labels are drawn.
  for (const r of rings) label(`${r} km`, cx - r * scale * 0.71 - 30, cy + r * scale * 0.71 + 12, 500, 9, c.label);

  if (view.extent <= 25) {
    for (const p of BASEMAP.suburbs) {
      const [x, y] = px(p.at);
      if (x < 10 || y < 10 || x > view.size - 10 || y > view.size - 10) continue;
      ctx.textAlign = 'center';
      label(p.name, x, y + 3, 500, small ? 9 : 10, c.label);
      ctx.textAlign = 'start';
    }
  }

  for (const p of BASEMAP.places) {
    const [x, y] = px(p.at);
    if (x < 0 || y < 0 || x > view.size || y > view.size) continue;
    ctx.fillStyle = c.strong;
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
    label(p.name, x + 4, y + 3, 500, small ? 9 : 11, c.label);
  }

  if (route && route.length > 1) {
    ctx.strokeStyle = c.land;
    ctx.lineWidth = 5;
    ctx.beginPath();
    trace(ctx, route, px);
    ctx.stroke();
    ctx.strokeStyle = c.strong;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    trace(ctx, route, px);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [i, p] of [route[0], route[route.length - 1]].entries()) {
      const [x, y] = px(p);
      ctx.beginPath();
      ctx.arc(x, y, i === 0 ? 3.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? c.land : c.strong;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.strong;
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = c.strong;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = c.land;
  ctx.stroke();
  label('München', cx + 8, cy + 4, 600, small ? 11 : 13, c.strong);
}
