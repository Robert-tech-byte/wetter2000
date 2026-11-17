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
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const step = hi - lo <= 5 ? 1 : hi - lo <= 12 ? 2 : hi - lo <= 25 ? 5 : 10;
  const tMin = Math.floor((lo - 0.3) / step) * step;
  const tMax = Math.ceil((hi + 0.3) / step) * step;
  const tTicks: number[] = [];
  for (let v = tMin; v <= tMax + 1e-9; v += step) tTicks.push(v);
  const rainMax = Math.max(1, Math.ceil(Math.max(...points.map((p) => p.rain ?? 0)) * 2) / 2);
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
      {/* Hour divisions: every 3 h, stronger every 6 h */}
      {points.map((p, i) => {
        const h = Number(p.time.slice(11, 13));
        if (h % 3 !== 0) return null;
        const xl = L + (i / n) * (W - L - R);
        return (
          <line key={`v${p.time}`} x1={xl} x2={xl} y1={TOP - 4} y2={RAIN_BOTTOM} className={h % 6 === 0 ? 'grid' : 'grid minor'} />
        );
      })}
      {/* Temperature divisions */}
      {tTicks.map((v) => (
        <g key={`t${v}`}>
          <line x1={L} x2={W - R} y1={yT(v)} y2={yT(v)} className={v === 0 ? 'grid zero' : 'grid'} />
          <text x={L - 4} y={yT(v) + 3} className="axis" textAnchor="end">
            {fmt0(v)}°
          </text>
        </g>
      ))}
      {/* Rain divisions */}
      {[rainMax / 2, rainMax].map((v) => (
        <g key={`r${v}`}>
          <line x1={L} x2={W - R} y1={yR(v)} y2={yR(v)} className="grid minor" />
          <text x={W - R + 4} y={yR(v) + 3} className="axis">
            {fmt1(v)}
          </text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={RAIN_BOTTOM} y2={RAIN_BOTTOM} className="grid" />
      <text x={W - R + 4} y={RAIN_BOTTOM + 3} className="axis">
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
        Number(p.time.slice(11, 13)) % 3 === 0 ? (
          <text key={p.time} x={L + (i / n) * (W - L - R)} y={H - 4} className="axis" textAnchor="middle">
            {p.time.slice(11, 13)}
          </text>
        ) : null,
      )}
      {nowIdx >= 0 && <line x1={x(nowIdx)} x2={x(nowIdx)} y1={TOP - 4} y2={RAIN_BOTTOM} className="now" />}
    </svg>
  );
}
