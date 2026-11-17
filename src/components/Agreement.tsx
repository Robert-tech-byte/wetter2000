import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  analyzeDays,
  confidenceLabel,
  hourAgreement,
  rainConsensus,
  type DayAgreement,
} from '../lib/agreement';
import type { MemberSet } from '../lib/api';
import { AGREEMENT_DAYS, EPS_MODEL, HIRES_MODELS, MIN_COVERAGE, RAIN_THRESHOLD, TEMP_TOLERANCE } from '../lib/config';
import { fmt1, mm, pct, temp } from '../lib/format';
import { formatDayShort, hhmm, localHourKey, relativeDayName } from '../lib/time';
import { useThemeColors } from '../lib/useThemeColors';

function Meter({ value }: { value: number | null }) {
  const label = confidenceLabel(value);
  return (
    <span className={`meter ${label ?? ''}`} role="img" aria-label={value == null ? 'keine Daten' : pct(value)}>
      <span style={{ width: `${(value ?? 0) * 100}%` }} />
    </span>
  );
}

function Badge({ value }: { value: number | null }) {
  const label = confidenceLabel(value);
  return label ? <span className={`badge ${label}`}>{label}</span> : <span className="badge">–</span>;
}

function rangeText(r: [number, number] | null, unit: (v: number) => string) {
  if (!r) return '';
  return r[0] === r[1] ? '' : ` (${unit(r[0])} bis ${unit(r[1])})`;
}

function DayCard({ day, eps, today }: { day: DayAgreement; eps: DayAgreement | null; today: string }) {
  const n = day.members.length;
  return (
    <article className="card agree-card">
      <h3>
        {relativeDayName(day.date, today)} <span className="muted small">{formatDayShort(day.date)}</span>
      </h3>
      <p className="muted small">
        {n} von {HIRES_MODELS.length} Modellen
        {day.date === today ? ' · ab jetzt' : ''}
      </p>

      <div className="agree-block">
        <div className="agree-head">
          <span>🌡️ Temperatur</span>
          <strong>{pct(day.tempAgreement)}</strong>
          <Badge value={day.tempAgreement} />
        </div>
        <Meter value={day.tempAgreement} />
        <p className="small">
          Max {temp(day.tMaxMedian)}
          <span className="muted">{rangeText(day.tMaxRange, (v) => `${fmt1(v)}°`)}</span>
          <br />
          Min {temp(day.tMinMedian)}
          <span className="muted">{rangeText(day.tMinRange, (v) => `${fmt1(v)}°`)}</span>
        </p>
      </div>

      <div className="agree-block">
        <div className="agree-head">
          <span>🌧️ Regen</span>
          <strong>{pct(day.rainProbability)}</strong>
          <Badge value={rainConsensus(day.rainProbability)} />
        </div>
        <Meter value={day.rainProbability} />
        <p className="small">
          {day.rainMembers} von {n} Modellen sagen Regen
          <br />
          Menge {mm(day.rainSumMedian)}
          <span className="muted">{rangeText(day.rainSumRange, (v) => fmt1(v))}</span>
        </p>
      </div>

      {eps && eps.members.length > 0 && (
        <div className="agree-eps small">
          <strong>{EPS_MODEL.name}</strong> ({eps.members.length} Läufe): Temperatur {pct(eps.tempAgreement)} · Regen{' '}
          {pct(eps.rainProbability)}
        </div>
      )}
      {eps && eps.members.length === 0 && (
        <div className="agree-eps small muted">{EPS_MODEL.name}: reicht nicht bis zu diesem Tag</div>
      )}
    </article>
  );
}

export function Agreement({ hires, eps }: { hires: MemberSet; eps: MemberSet | null }) {
  const c = useThemeColors();
  const [showTable, setShowTable] = useState(false);
  const nowKey = localHourKey();
  const today = nowKey.slice(0, 10);

  const days = useMemo(() => analyzeDays(hires.time, hires.members, nowKey, AGREEMENT_DAYS), [hires, nowKey]);
  const epsDays = useMemo(
    () => (eps ? analyzeDays(eps.time, eps.members, nowKey, AGREEMENT_DAYS) : null),
    [eps, nowKey],
  );

  const hourly = useMemo(() => {
    const start = Math.max(0, hires.time.indexOf(nowKey));
    const epsIndex = new Map(eps?.time.map((t, i) => [t, i]) ?? []);
    return hires.time.slice(start).map((t, k) => {
      const h = hourAgreement(hires.time, hires.members, start + k);
      const ei = epsIndex.get(t);
      const e = eps && ei != null ? hourAgreement(eps.time, eps.members, ei) : null;
      return {
        time: t,
        label: `${relativeDayName(t, today).slice(0, 2)} ${hhmm(t)}`,
        band: h.tempLow != null && h.tempHigh != null ? [h.tempLow, h.tempHigh] : null,
        median: h.tempMedian,
        rain: h.rainProbability != null ? Math.round(h.rainProbability * 100) : null,
        epsRain: e && e.n > 0 && e.rainProbability != null ? Math.round(e.rainProbability * 100) : null,
        n: h.n,
      };
    });
  }, [hires, eps, nowKey, today]);

  return (
    <>
      <div className="agree-grid">
        {days.map((d, i) => (
          <DayCard key={d.date} day={d} eps={epsDays?.[i] ?? null} today={today} />
        ))}
      </div>

      <div className="card chart-card">
        <h3 className="chart-title">Stündlich: Temperatur-Spanne aller Modelle &amp; Regenwahrscheinlichkeit</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={hourly} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={c['--grid']} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c['--muted'], fontSize: 11 }} interval={5} />
            <YAxis yAxisId="t" unit="°" tick={{ fill: c['--muted'], fontSize: 11 }} width={44} domain={['auto', 'auto']} />
            <YAxis
              yAxisId="p"
              orientation="right"
              unit="%"
              domain={[0, 100]}
              tick={{ fill: c['--muted'], fontSize: 11 }}
              width={44}
            />
            <Tooltip
              contentStyle={{ background: c['--surface'], border: `1px solid ${c['--grid']}`, color: c['--text'] }}
              formatter={(v: number | number[], name: string) => {
                if (Array.isArray(v)) return [`${fmt1(v[0])} bis ${fmt1(v[1])} °C`, name];
                if (name.startsWith('Regen')) return [`${v} %`, name];
                return [`${fmt1(v)} °C`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: c['--muted'] }} />
            <Bar isAnimationActive={false} yAxisId="p" dataKey="rain" name="Regen (Modelle)" fill={c['--rain']} opacity={0.5} />
            <Line isAnimationActive={false} yAxisId="p" dataKey="epsRain" name="Regen (EPS)" stroke={c['--eps']} dot={false} strokeWidth={2} connectNulls={false} />
            <Area isAnimationActive={false} yAxisId="t" dataKey="band" name="Temp.-Spanne" stroke="none" fill={c['--temp-max']} fillOpacity={0.2} />
            <Line isAnimationActive={false} yAxisId="t" dataKey="median" name="Temp. Median" stroke={c['--temp-max']} dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <button className="link-button" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
        {showTable ? '▾' : '▸'} Werte der einzelnen Modelle
      </button>
      {showTable && (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Modell</th>
                <th>Auflösung</th>
                {days.map((d) => (
                  <th key={d.date}>{relativeDayName(d.date, today)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HIRES_MODELS.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.name} <span className="muted small">{m.provider}</span>
                  </td>
                  <td>ca. {String(m.resolutionKm).replace('.', ',')} km</td>
                  {days.map((d) => {
                    const s = d.members.find((x) => x.id === m.id);
                    return (
                      <td key={d.date} className={s ? '' : 'muted'}>
                        {s ? (
                          <>
                            {fmt1(s.tMin)}° / {fmt1(s.tMax)}°
                            <br />
                            <span className={s.rains ? 'rain-yes' : 'muted'}>{mm(s.rainSum)}</span>
                          </>
                        ) : (
                          'keine Daten'
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="method card">
        <summary>So wird gerechnet</summary>
        <ul>
          <li>
            Grundlage sind {HIRES_MODELS.length} hochauflösende Wettermodelle mit höchstens 7 km Gitterabstand, deren
            Gebiet München abdeckt. Ein Modell zählt für einen Tag nur, wenn es mindestens{' '}
            {Math.round(MIN_COVERAGE * 100)} % der Stunden liefert. Die meisten reichen nur 1,5–2,5 Tage voraus, deshalb
            sind es am dritten Tag weniger Modelle.
          </li>
          <li>
            <strong>Temperatur:</strong> Für jede Stunde wird der Median aller Modelle gebildet und gezählt, wie viele
            Modelle höchstens ±{fmt1(TEMP_TOLERANCE)} °C davon abweichen. Der Tageswert ist der Durchschnitt über alle
            Stunden.
          </li>
          <li>
            <strong>Regen:</strong> Anteil der Modelle, die in mindestens einer Stunde ≥ {fmt1(RAIN_THRESHOLD)} mm
            vorhersagen. Die Einstufung (hoch/mittel/niedrig) beschreibt, wie einig sich die Modelle sind – bei 50 % ist
            sie am niedrigsten.
          </li>
          <li>
            <strong>{EPS_MODEL.name}:</strong> {EPS_MODEL.members} leicht variierte Läufe eines Modells (DWD,{' '}
            {String(EPS_MODEL.resolutionKm).replace('.', ',')} km). Gleiche Rechnung, separat angezeigt; reicht ca. 2
            Tage voraus.
          </li>
          <li>
            Wichtig: Das ist eine <em>Modell-Übereinstimmung</em>, keine statistisch kalibrierte Wahrscheinlichkeit.
            Modelle derselben Familie (z. B. ICON-D2/-EU/-CH) sind nicht völlig unabhängig.
          </li>
        </ul>
      </details>
    </>
  );
}
