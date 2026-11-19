import { useMemo } from 'react';
import { localHourKey } from '../lib/time';
import type { EcmwfForecast } from '../lib/api';
import { cloudColor, nextDays, trendSummary, type TrendData } from '../lib/trend';

const W = 358;
const T = 18; // top of the temperature area (room for the max labels)
const B = 150; // bottom of the temperature area
const CY = 172; // cloud band (below the lowest minimum labels)
const CH = 10;
const RT = 214; // top of the rain bars (mm labels sit above them)
const RH = 30; // height of the rain bars
const H = RT + RH + 30;

const WEEKDAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });
const wd = (date: string) => WEEKDAY.format(new Date(`${date}T00:00:00Z`)).replace('.', '').slice(0, 2);
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
const num = (v: number) => String(Math.round(v)).replace('-', '−');
const mmText = (v: number) => (v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace('.', ','));

function openDay(date: string) {
  const el = document.getElementById(`day-${date}`) as HTMLDetailsElement | null;
  if (!el) return;
  el.open = true;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
}

/**
 * 15 days including today (concept B, after Dieter Rams): the most likely value only, i.e. the
 * median of the ECMWF ensemble runs. Maximum as filled red dots, minimum as open blue dots, each
 * value written at its dot; the zero line is the only guide. Below: rain bars (amount in mm,
 * written above the bar) and the rain probability in %.
 */
export function Trend14({ data, ecmwf }: { data: TrendData | null; ecmwf?: EcmwfForecast | null }) {
  const today = localHourKey().slice(0, 10);
  const days = useMemo(() => (data ? nextDays(data, today, 15) : []), [data, today]);
  // Sunrise/sunset per day (ECMWF daily) to tell day from night; fallback 7–17 h.
  const sun = useMemo(() => {
    const m = new Map<string, [number, number]>();
    ecmwf?.daily.time.forEach((d, i) => {
      const h = (t: string) => Number(t.slice(11, 13)) + Number(t.slice(14, 16)) / 60;
      if (ecmwf.daily.sunrise[i] && ecmwf.daily.sunset[i]) m.set(d, [h(ecmwf.daily.sunrise[i]), h(ecmwf.daily.sunset[i])]);
    });
    return m;
  }, [ecmwf]);
  if (days.length < 7) return null;

  const n = days.length;
  const step = W / n;
  const x = (i: number) => (i + 0.5) * step;
  const lo = Math.min(...days.map((d) => d.min.p50)) - 1;
  const hi = Math.max(...days.map((d) => d.max.p50)) + 1;
  const y = (v: number) => B - ((v - lo) / (hi - lo)) * (B - T);
  const path = (k: 'max' | 'min') => 'M' + days.map((d, i) => `${x(i).toFixed(1)},${y(d[k].p50).toFixed(1)}`).join('L');
  const rmax = Math.max(1, ...days.map((d) => d.rain.p50));

  // Cloud band: one gradient stop per 3-hour block at its centre, placed on the day columns.
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  const cloudStops = (data?.clouds ?? [])
    .map(([t, c]) => {
      const i = dayIndex.get(t.slice(0, 10));
      if (i == null) return null;
      const hour = Number(t.slice(11, 13)) + 1.5;
      const [rise, set] = sun.get(t.slice(0, 10)) ?? [7, 17];
      return { x: (i + hour / 24) * step, color: cloudColor(c, hour < rise || hour > set) };
    })
    .filter((v): v is { x: number; color: string } => v != null);

  return (
    <section className="trend14" aria-labelledby="trend-title">
      <h2 id="trend-title" className="block-title">
        {n} Tage
      </h2>
      <p className="t-sum">{trendSummary(days)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="t-chart" role="img" aria-label={`Temperatur und Regen der nächsten ${n} Tage`}>
        {lo < 0 && hi > 0 && (
          <g>
            <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="t-zero" />
            <text x={W} y={y(0) - 4} textAnchor="end" className="t-axis">
              0°
            </text>
          </g>
        )}
        <path d={path('min')} className="t-line t-min" />
        <path d={path('max')} className="t-line t-max" />
        {days.map((d, i) => (
          <g key={d.date}>
            <circle cx={x(i)} cy={y(d.max.p50)} r={3} className="t-dot-max" />
            <text x={x(i)} y={y(d.max.p50) - 7} textAnchor="middle" className="t-val t-val-max">
              {num(d.max.p50)}
            </text>
            <circle cx={x(i)} cy={y(d.min.p50)} r={2.8} className="t-dot-min" />
            <text x={x(i)} y={y(d.min.p50) + 14} textAnchor="middle" className="t-val t-val-min">
              {num(d.min.p50)}
            </text>
          </g>
        ))}

        {cloudStops.length > 4 && (
          <g>
            <defs>
              <linearGradient id="t-clouds" gradientUnits="userSpaceOnUse" x1={0} x2={W} y1={0} y2={0}>
                {cloudStops.map((c) => (
                  <stop key={c.x} offset={Math.max(0, Math.min(1, c.x / W))} stopColor={c.color} />
                ))}
              </linearGradient>
            </defs>
            <rect
              x={0}
              y={CY}
              width={Math.min(W, cloudStops[cloudStops.length - 1].x + (step * 1.5) / 24)}
              height={CH}
              rx={3}
              fill="url(#t-clouds)"
            />
          </g>
        )}
        <line x1={0} x2={W} y1={RT + RH} y2={RT + RH} className="t-base" />
        {days.map((d, i) => {
          const h = (d.rain.p50 / rmax) * RH;
          const wet = d.rain.prob >= 0.5;
          return (
            <g key={`r${d.date}`}>
              {d.rain.p50 >= 0.1 && (
                <>
                  <rect x={x(i) - 4} y={RT + RH - Math.max(h, 1)} width={8} height={Math.max(h, 1)} className="t-rain" />
                  <text x={x(i)} y={RT + RH - Math.max(h, 1) - 4} textAnchor="middle" className="t-mm">
                    {mmText(d.rain.p50)}
                  </text>
                </>
              )}
              <text x={x(i)} y={RT + RH + 12} textAnchor="middle" className={wet ? 't-pct wet' : 't-pct'}>
                {Math.round(d.rain.prob * 100)}
              </text>
              <text
                x={x(i)}
                y={H - 2}
                textAnchor="middle"
                className={i === 0 || isWeekend(d.date) ? 't-day strong' : 't-day'}
              >
                {i === 0 ? 'H' : wd(d.date)}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => (
          <rect
            key={`h${d.date}`}
            x={i * step}
            y={0}
            width={step}
            height={H}
            className="t-hit"
            role="button"
            tabIndex={0}
            aria-label={`${i === 0 ? 'Heute' : wd(d.date)}: Höchstwert ${num(d.max.p50)} Grad, Tiefstwert ${num(d.min.p50)} Grad, Regen ${d.rain.p50 >= 0.1 ? `${mmText(d.rain.p50)} Millimeter` : 'unter 0,1 Millimeter'}, Wahrscheinlichkeit ${Math.round(d.rain.prob * 100)} Prozent`}
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
          <b className="t-min-c">○</b> Tiefstwert in °C
        </span>
        <span>
          <b className="t-rain-c">▮</b> Regen in mm, darunter Wahrscheinlichkeit in %
        </span>
        {cloudStops.length > 4 && (
          <span>
            <b className="t-cloud-c" aria-hidden="true" /> Bewölkung: gelb sonnig, grau bewölkt, blau klare Nacht
          </span>
        )}
        <span>H = heute</span>
      </p>
    </section>
  );
}
