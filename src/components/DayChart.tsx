import { fmt0, fmt1 } from '../lib/format';

export interface HourPoint {
  /** Local "YYYY-MM-DDTHH:00". */
  time: string;
  temp: number | null;
  lo?: number | null;
  hi?: number | null;
  /** Precipitation in mm for this hour. */
  rain: number | null;
}

const W = 320;
const H = 150;
const L = 26;
const R = 26;
const TOP = 10;
const TEMP_BOTTOM = 92;
const RAIN_TOP = 104;
const RAIN_BOTTOM = 132;

/** Compact hourly chart: temperature line (with model spread) above, rain bars below. */
export function DayChart({ points, nowKey }: { points: HourPoint[]; nowKey?: string }) {
  const temps = points.flatMap((p) => [p.temp, p.lo, p.hi]).filter((v): v is number => v != null);
  if (!temps.length) return <p className="note">Für diesen Tag liegen keine Stundenwerte vor.</p>;
  const tMin = Math.floor(Math.min(...temps) - 0.5);
  const tMax = Math.ceil(Math.max(...temps) + 0.5);
  const rainMax = Math.max(1, ...points.map((p) => p.rain ?? 0));
  const n = points.length;
  const x = (i: number) => L + ((i + 0.5) / n) * (W - L - R);
  const yT = (v: number) => TEMP_BOTTOM - ((v - tMin) / (tMax - tMin)) * (TEMP_BOTTOM - TOP);
  const yR = (v: number) => RAIN_BOTTOM - (v / rainMax) * (RAIN_BOTTOM - RAIN_TOP);

  const line = (get: (p: HourPoint) => number | null | undefined) => {
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      const v = get(p);
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${yT(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const bandIdx = points.map((p, i) => (p.lo != null && p.hi != null ? i : -1)).filter((i) => i >= 0);
  const band =
    bandIdx.length > 1
      ? `M${bandIdx.map((i) => `${x(i).toFixed(1)},${yT(points[i].hi!).toFixed(1)}`).join('L')}L${[...bandIdx]
          .reverse()
          .map((i) => `${x(i).toFixed(1)},${yT(points[i].lo!).toFixed(1)}`)
          .join('L')}Z`
      : '';

  const bar = (W - L - R) / n;
  const nowIdx = nowKey ? points.findIndex((p) => p.time === nowKey) : -1;
  const hottest = points.reduce((b, p, i) => (p.temp != null && (b < 0 || p.temp > points[b].temp!) ? i : b), -1);
  const coldest = points.reduce((b, p, i) => (p.temp != null && (b < 0 || p.temp < points[b].temp!) ? i : b), -1);

  return (
    <svg className="day-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Stündlicher Verlauf von Temperatur und Regen">
      {[tMin, tMax].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={yT(v)} y2={yT(v)} className="grid" />
          <text x={L - 4} y={yT(v) + 3} className="axis" textAnchor="end">
            {fmt0(v)}°
          </text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={RAIN_BOTTOM} y2={RAIN_BOTTOM} className="grid" />
      <text x={W - R + 4} y={RAIN_TOP + 4} className="axis">
        {fmt1(rainMax)}
      </text>
      <text x={W - R + 4} y={RAIN_BOTTOM} className="axis">
        mm
      </text>

      {nowIdx >= 0 && <rect x={L} y={TOP - 4} width={x(nowIdx) - L} height={RAIN_BOTTOM - TOP + 4} className="past" />}

      {points.map((p, i) =>
        p.rain != null && p.rain >= 0.05 ? (
          <rect
            key={p.time}
            x={x(i) - bar * 0.38}
            width={bar * 0.76}
            y={yR(p.rain)}
            height={RAIN_BOTTOM - yR(p.rain)}
            rx={1.5}
            className="rain"
          />
        ) : null,
      )}

      {band && <path d={band} className="band" />}
      <path d={line((p) => p.temp)} className="temp" />
      {[hottest, coldest].filter((i, k, a) => i >= 0 && a.indexOf(i) === k).map((i) => (
        <g key={i}>
          <circle cx={x(i)} cy={yT(points[i].temp!)} r={2.5} className="dot" />
          <text x={x(i)} y={yT(points[i].temp!) + (i === hottest ? -6 : 12)} className="val" textAnchor="middle">
            {fmt0(points[i].temp)}°
          </text>
        </g>
      ))}

      {points.map((p, i) =>
        Number(p.time.slice(11, 13)) % 6 === 0 ? (
          <text key={p.time} x={x(i)} y={H - 4} className="axis" textAnchor="middle">
            {p.time.slice(11, 13)}
          </text>
        ) : null,
      )}
      {nowIdx >= 0 && <line x1={x(nowIdx)} x2={x(nowIdx)} y1={TOP - 4} y2={RAIN_BOTTOM} className="now" />}
    </svg>
  );
}
