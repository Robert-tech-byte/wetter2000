import { useMemo } from 'react';
import { localHourKey } from '../lib/time';
import { next14, trendSummary, type Pct, type TrendData, type TrendDay } from '../lib/trend';

const W = 358;
const H = 214;
const WL = 26; // left margin for the axis
const WR = 8;
const T = 10; // top of the temperature area
const B = 140; // bottom of the temperature area
const RT = 152; // top of the rain area
const RH = 26; // height of the rain area

const WEEKDAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });
const wd = (date: string) => WEEKDAY.format(new Date(`${date}T00:00:00Z`)).replace('.', '').slice(0, 2);
const num = (v: number) => String(Math.round(v)).replace('-', '−');

function openDay(date: string) {
  const el = document.getElementById(`day-${date}`) as HTMLDetailsElement | null;
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
}

/**
 * 14-day trend (variant D2 + R2): for maximum (red) and minimum (blue) temperature an
 * uncertainty stroke per day – thin for the possible range (80 % of ensemble runs), thick for
 * the likely range (50 %) – and the median as an open dot on a connecting line, value beside it.
 * Rain below: frame = possible amount (90th percentile), fill = likely amount, % = probability.
 */
export function Trend14({ data }: { data: TrendData | null }) {
  const today = localHourKey().slice(0, 10);
  const days = useMemo(() => (data ? next14(data, today) : []), [data, today]);
  if (days.length < 7) return null;

  const n = days.length;
  const step = (W - WL - WR) / n;
  const x = (i: number) => WL + (i + 0.5) * step;
  const temps = days.flatMap((d) => [d.max.p90, d.min.p10]);
  const lo = Math.floor(Math.min(...temps) - 1);
  const hi = Math.ceil(Math.max(...temps) + 1);
  const y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) ticks.push(v);
  const rmax = Math.max(1, ...days.map((d) => d.rain.p90));
  const weekBreak = days.findIndex((d, i) => i > 0 && new Date(`${d.date}T00:00:00Z`).getUTCDay() === 1);
  const path = (get: (d: TrendDay) => Pct, dx: number) =>
    'M' + days.map((d, i) => `${(x(i) + dx).toFixed(1)},${y(get(d).p50).toFixed(1)}`).join('L');

  // Max slightly left, min slightly right so overlapping ranges stay distinguishable;
  // the value sits above (max) or below (min) the dot, clear of the connecting line.
  const series = (get: (d: TrendDay) => Pct, cls: string, dx: number, dy: number) => (
    <g className={cls}>
      {days.map((d, i) => {
        const p = get(d);
        return (
          <g key={d.date}>
            <line x1={x(i) + dx} x2={x(i) + dx} y1={y(p.p90)} y2={y(p.p10)} className="t-poss" />
            <line x1={x(i) + dx} x2={x(i) + dx} y1={y(p.p75)} y2={y(p.p25)} className="t-likely" />
          </g>
        );
      })}
      <path d={path(get, dx)} className="t-line" />
      {days.map((d, i) => (
        <circle key={`c${d.date}`} cx={x(i) + dx} cy={y(get(d).p50)} r={2.3} className="t-dot" />
      ))}
      {days.map((d, i) => (
        <text key={`v${d.date}`} x={x(i) + dx + 3} y={y(get(d).p50) + dy} className="t-val">
          {num(get(d).p50)}
        </text>
      ))}
    </g>
  );

  return (
    <section className="trend14" aria-labelledby="trend-title">
      <div className="t-head">
        <h2 id="trend-title" className="block-title">
          14 Tage
        </h2>
      </div>
      <p className="t-sum">{trendSummary(days)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="t-chart" role="img" aria-label="Temperatur- und Regentrend der nächsten 14 Tage">
        {ticks.map((v) => (
          <g key={`g${v}`}>
            <line x1={WL} x2={W - WR} y1={y(v)} y2={y(v)} className={v === 0 ? 't-zero' : 't-grid'} />
            <text x={WL - 4} y={y(v) + 3} textAnchor="end" className="t-axis">
              {num(v)}°
            </text>
          </g>
        ))}
        {weekBreak > 0 && <line x1={WL + weekBreak * step} x2={WL + weekBreak * step} y1={T} y2={RT + RH} className="t-week" />}
        {series((d) => d.min, 't-min', 1.8, 11)}
        {series((d) => d.max, 't-max', -1.8, -4.5)}

        <text x={WL - 4} y={RT + RH} textAnchor="end" className="t-axis">
          mm
        </text>
        {days.map((d, i) => {
          const h90 = (d.rain.p90 / rmax) * RH;
          const hm = (d.rain.p50 / rmax) * RH;
          const bx = x(i) - step * 0.3;
          return (
            <g key={`r${d.date}`}>
              {h90 > 0.5 && <rect x={bx} y={RT + RH - h90} width={step * 0.6} height={h90} rx={1.5} className="t-rain-poss" />}
              {hm > 0.5 && <rect x={bx} y={RT + RH - hm} width={step * 0.6} height={hm} rx={1.5} className="t-rain" />}
              <text x={x(i)} y={RT + RH + 11} textAnchor="middle" className="t-pct">
                {Math.round(d.rain.prob * 100)}%
              </text>
            </g>
          );
        })}
        {days.map((d, i) => (
          <text key={`d${d.date}`} x={x(i)} y={H - 3} textAnchor="middle" className={i === 0 || i === weekBreak ? 't-day strong' : 't-day'}>
            {wd(d.date)}
          </text>
        ))}
        {days.map((d, i) => (
          <rect
            key={`h${d.date}`}
            x={WL + i * step}
            y={0}
            width={step}
            height={H}
            className="t-hit"
            role="button"
            tabIndex={0}
            aria-label={`${wd(d.date)}: Höchstwert ${num(d.max.p50)} Grad, Tiefstwert ${num(d.min.p50)} Grad, Regenwahrscheinlichkeit ${Math.round(d.rain.prob * 100)} Prozent`}
            onClick={() => openDay(d.date)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openDay(d.date)}
          />
        ))}
      </svg>
      <p className="t-legend">
        <span className="t-max-c">○ Höchstwert</span>
        <span className="t-min-c">○ Tiefstwert</span>
        <span>dick 50 %, dünn 80 % der Läufe</span>
        <span>
          <b className="t-rain-c">▮</b> Regen wahrscheinlich, ▯ möglich, % Wahrscheinlichkeit
        </span>
      </p>
      <p className="note">
        ECMWF-Ensemble ({days[0].members} Läufe) über Open-Meteo. Antippen eines Tages öffnet ihn unten.
      </p>
    </section>
  );
}
