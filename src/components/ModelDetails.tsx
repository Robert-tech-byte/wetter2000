import { useMemo } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { hourAgreement, type DayAgreement } from '../lib/agreement';
import type { MemberSet } from '../lib/api';
import { HIRES_MODELS } from '../lib/config';
import { fmt1, mm } from '../lib/format';
import { hhmm, localHourKey, relativeDayName } from '../lib/time';
import { useThemeColors } from '../lib/useThemeColors';

interface Props {
  hires: MemberSet;
  eps: MemberSet | null;
  days: DayAgreement[];
}

export default function ModelDetails({ hires, eps, days }: Props) {
  const c = useThemeColors();
  const nowKey = localHourKey();
  const today = nowKey.slice(0, 10);

  const hourly = useMemo(() => {
    const start = Math.max(0, hires.time.indexOf(nowKey));
    const epsIndex = new Map(eps?.time.map((t, i) => [t, i]) ?? []);
    return hires.time.slice(start).map((t, k) => {
      const h = hourAgreement(hires.time, hires.members, start + k);
      const ei = epsIndex.get(t);
      const e = eps && ei != null ? hourAgreement(eps.time, eps.members, ei) : null;
      return {
        label: `${relativeDayName(t, today).slice(0, 2)} ${hhmm(t)}`,
        band: h.tempLow != null && h.tempHigh != null ? [h.tempLow, h.tempHigh] : null,
        median: h.tempMedian,
        rain: h.rainProbability != null ? Math.round(h.rainProbability * 100) : null,
        epsRain: e && e.n > 0 && e.rainProbability != null ? Math.round(e.rainProbability * 100) : null,
      };
    });
  }, [hires, eps, nowKey, today]);

  const axis = { fill: c['--muted'], fontSize: 11 };

  return (
    <div className="model-details">
      <p className="note">Linie: Median aller Modelle, Fläche: Spanne. Balken: Anteil der Modelle mit Regen, Linie lila: ICON-D2-EPS.</p>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={hourly} margin={{ top: 6, right: 0, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={c['--line']} vertical={false} />
            <XAxis dataKey="label" tick={axis} interval={11} tickLine={false} axisLine={false} />
            <YAxis yAxisId="t" unit="°" tick={axis} width={40} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <YAxis yAxisId="p" orientation="right" unit="%" domain={[0, 100]} tick={axis} width={40} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: c['--surface'], border: `1px solid ${c['--line']}`, color: c['--fg'], fontSize: 12 }}
              formatter={(v: number | number[], name: string) => {
                if (Array.isArray(v)) return [`${fmt1(v[0])} bis ${fmt1(v[1])} °C`, name];
                if (name.startsWith('Regen')) return [`${v} %`, name];
                return [`${fmt1(v)} °C`, name];
              }}
            />
            <Bar isAnimationActive={false} yAxisId="p" dataKey="rain" name="Regen Modelle" fill={c['--accent']} opacity={0.35} />
            <Line isAnimationActive={false} yAxisId="p" dataKey="epsRain" name="Regen EPS" stroke="#8b6fe8" dot={false} strokeWidth={1.5} />
            <Area isAnimationActive={false} yAxisId="t" dataKey="band" name="Spanne" stroke="none" fill={c['--fg']} fillOpacity={0.1} />
            <Line isAnimationActive={false} yAxisId="t" dataKey="median" name="Temperatur" stroke={c['--fg']} dot={false} strokeWidth={1.8} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Modell</th>
              {days.map((d) => (
                <th key={d.date}>{relativeDayName(d.date, today)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HIRES_MODELS.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.name}
                  <small>
                    {m.provider} · {String(m.resolutionKm).replace('.', ',')} km
                  </small>
                </td>
                {days.map((d) => {
                  const s = d.members.find((x) => x.id === m.id);
                  return (
                    <td key={d.date}>
                      {s ? (
                        <>
                          {fmt1(s.tMin)}° / {fmt1(s.tMax)}°
                          <small className={s.rains ? 'wet' : ''}>{mm(s.rainSum)}</small>
                        </>
                      ) : (
                        <small>–</small>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
