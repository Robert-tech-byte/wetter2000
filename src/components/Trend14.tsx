import { useMemo } from 'react';
import { localHourKey } from '../lib/time';
import { next14, trendSummary, type Pct, type TrendData, type TrendDay } from '../lib/trend';

const W = 358;
const H = 206;
const WL = 30; // left margin for the axis
const WR = 8;
const T = 12; // top of the temperature area
const B = 136; // bottom of the temperature area
const RT = 148; // top of the rain area
const RH = 24; // height of the rain area

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
 * 14-day trend in a reduced, Dieter-Rams-inspired style: for maximum (warm) and minimum
 * (cool) temperature a hairline for the possible range (80 % of ensemble runs), a short bold
 * segment for the likely range (50 %), a dot for the median with its value right next to it.
 * Rain below: frame = possible amount (90th percentile), fill = likely amount, % = probability.
 */
export function Trend14({ data }: { data: TrendData | null }) {
  const today = localHourKey().slice(0, 10);
  const days = useMemo(() => (data ? next14(data, today) : []), [data, today]);
  if (days.length < 7) return null;

  const n = days.length;
  const cw = (W - WL - WR) / n;
  const cx = (i: number) => WL + (i + 0.32) * cw;
  const temps = days.flatMap((d) => [d.max.p90, d.min.p10]);
  const lo = Math.floor(Math.min(...temps) - 1);
  const hi = Math.ceil(Math.max(...temps) + 2);
  const y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) ticks.push(v);
  const rmax = Math.max(1, ...days.map((d) => d.rain.p90));
  const weekBreak = days.findIndex((d) => new Date(`${d.date}T00:00:00Z`).getUTCDay() === 1);

  const mark = (p: Pct, i: number, cls: string) => {
    const x = cx(i);
    const ym = y(p.p50);
    return (
      <g className={cls} key={cls}>
        <line x1={x} x2={x} y1={y(p.p90)} y2={y(p.p10)} className="t-poss" />
        <line x1={x} x2={x} y1={y(p.p75)} y2={y(p.p25)} className="t-likely" />
        <circle cx={x} cy={ym} r={2.8} className="t-dot" />
        <text x={x + 4.6} y={ym + 3.1} className="t-val">
          {num(p.p50)}
        </text>
      </g>
    );
  };

  const rain = (d: TrendDay, i: number) => {
    const x = cx(i) - 3;
    const h90 = (d.rain.p90 / rmax) * RH;
    const hm = (d.rain.p50 / rmax) * RH;
    return (
      <g key={`r${d.date}`}>
        {h90 > 0.3 && <rect x={x} y={RT + RH - h90} width={6} height={h90} className="t-rain-poss" />}
        {hm > 0.3 && <rect x={x} y={RT + RH - hm} width={6} height={hm} className="t-rain" />}
        <text x={cx(i)} y={RT + RH + 11} textAnchor="middle" className="t-pct">
          {Math.round(d.rain.prob * 100)}
        </text>
      </g>
    );
  };

  return (
    <section className="trend14" aria-labelledby="trend-title">
      <div className="t-head">
        <h2 id="trend-title" className="block-title">
          14 Tage
        </h2>
        <span className="t-unit">°C · mm · %</span>
      </div>
      <p className="t-sum">{trendSummary(days)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="t-chart" role="img" aria-label="Temperatur- und Regentrend der nächsten 14 Tage">
        {ticks.map((v) => (
          <g key={`g${v}`}>
            <line x1={WL} x2={W - WR} y1={y(v)} y2={y(v)} className={v === 0 ? 't-zero' : 't-grid'} />
            <text x={WL - 6} y={y(v) + 3} textAnchor="end" className="t-axis">
              {num(v)}
            </text>
          </g>
        ))}
        {weekBreak > 0 && (
          <line x1={WL + weekBreak * cw - 2} x2={WL + weekBreak * cw - 2} y1={T} y2={RT + RH + 13} className="t-grid" />
        )}
        {days.map((d, i) => (
          <g key={d.date}>
            {mark(d.max, i, 't-max')}
            {mark(d.min, i, 't-min')}
          </g>
        ))}
        <line x1={WL} x2={W - WR} y1={RT + RH} y2={RT + RH} className="t-grid" />
        <text x={WL - 6} y={RT + RH} textAnchor="end" className="t-axis">
          mm
        </text>
        {days.map(rain)}
        {days.map((d, i) => (
          <text key={`d${d.date}`} x={cx(i)} y={H - 4} textAnchor="middle" className={i === 0 || i === weekBreak ? 't-day strong' : 't-day'}>
            {wd(d.date)}
          </text>
        ))}
        {days.map((d, i) => (
          <rect
            key={`h${d.date}`}
            x={WL + i * cw}
            y={0}
            width={cw}
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
        <span>
          <b className="t-max-c">●</b> Höchstwert
        </span>
        <span>
          <b className="t-min-c">●</b> Tiefstwert
        </span>
        <span>kräftig: wahrscheinlich · fein: möglich</span>
        <span>
          <b className="t-rain-c">▮</b> Regen mm, darunter %
        </span>
      </p>
      <p className="note">
        ECMWF-Ensemble ({days[0].members} Läufe) über Open-Meteo. Antippen eines Tages öffnet ihn unten.
      </p>
    </section>
  );
}
