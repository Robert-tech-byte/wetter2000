import { lazy, Suspense, useMemo, useState } from 'react';
import { analyzeDays, CONFIDENCE_WORD, dayConfidence, rainConsensus, type DayAgreement } from '../lib/agreement';
import type { EcmwfForecast, MemberSet } from '../lib/api';
import { AGREEMENT_DAYS, EPS_MODEL, HIRES_MODELS, TEMP_TOLERANCE } from '../lib/config';
import { fmt0, fmt1, mm, pct } from '../lib/format';
import { formatDayShort, hhmm, localHourKey, relativeDayName } from '../lib/time';
import { describeWeather } from '../lib/weatherCodes';
import { ConfidenceDots } from './Confidence';
import { DayRow, type Scale } from './DayRow';

const ModelDetails = lazy(() => import('./ModelDetails'));

interface Props {
  ecmwf: EcmwfForecast | null;
  hires: MemberSet | null;
  eps: MemberSet | null;
}

const span = (r: [number, number] | null, f: (v: number) => string) => (r ? `${f(r[0])} bis ${f(r[1])}` : '–');

function ModelGrid({ day }: { day: DayAgreement }) {
  return (
    <div className="models" role="list" aria-label="Regen je Modell">
      {HIRES_MODELS.map((m) => {
        const s = day.members.find((x) => x.id === m.id);
        const state = !s ? 'na' : s.rains ? 'rain' : 'dry';
        const text = !s ? 'reicht nicht so weit' : s.rains ? `Regen, ${mm(s.rainSum)}` : 'trocken';
        return <i key={m.id} role="listitem" className={state} title={`${m.name}: ${text}`} aria-label={`${m.name}: ${text}`} />;
      })}
    </div>
  );
}

function AgreementDetail({ day, eps }: { day: DayAgreement; eps: DayAgreement | null }) {
  const conf = dayConfidence(day);
  const n = day.members.length;
  return (
    <div className="agree">
      <p className="agree-head">
        <strong>{conf ? CONFIDENCE_WORD[conf.level] : 'keine Aussage'}</strong>
        <span>
          {n} von {HIRES_MODELS.length} Modellen
        </span>
      </p>
      <dl className="kv">
        <div>
          <dt>Temperatur ±{fmt1(TEMP_TOLERANCE)} °C</dt>
          <dd>{pct(day.tempAgreement)} einig</dd>
        </div>
        <div>
          <dt>Regen</dt>
          <dd>
            {day.rainMembers} von {n} Modellen
            <span className="sub">{pct(rainConsensus(day.rainProbability))} einig</span>
          </dd>
        </div>
        <div>
          <dt>Höchstwert</dt>
          <dd>{span(day.tMaxRange, (v) => `${fmt1(v)}°`)}</dd>
        </div>
        <div>
          <dt>Regenmenge</dt>
          <dd>{span(day.rainSumRange, (v) => fmt1(v))} mm</dd>
        </div>
      </dl>
      <ModelGrid day={day} />
      <p className="note">
        {EPS_MODEL.name}:{' '}
        {eps && eps.members.length
          ? `Temperatur ${pct(eps.tempAgreement)} einig, Regen in ${pct(eps.rainProbability)} der ${eps.members.length} Läufe`
          : 'reicht nicht bis zu diesem Tag'}
      </p>
    </div>
  );
}

export function Days({ ecmwf, hires, eps }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const nowKey = localHourKey();
  const today = nowKey.slice(0, 10);

  const agreement = useMemo(
    () => (hires ? analyzeDays(hires.time, hires.members, nowKey, AGREEMENT_DAYS) : []),
    [hires, nowKey],
  );
  const epsDays = useMemo(
    () => (eps ? analyzeDays(eps.time, eps.members, nowKey, AGREEMENT_DAYS) : []),
    [eps, nowKey],
  );

  if (!ecmwf) return null;
  const d = ecmwf.daily;
  const days = d.time
    .map((date, i) => ({
      date,
      i,
      lo: d.temperature_2m_min[i],
      hi: d.temperature_2m_max[i],
      rain: d.precipitation_sum[i],
      gust: d.wind_gusts_10m_max[i],
      cond: describeWeather(d.weather_code[i]),
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
    }))
    .filter((x): x is typeof x & { lo: number; hi: number } => x.lo != null && x.hi != null);
  const scale: Scale = { lo: Math.min(...days.map((x) => x.lo)), hi: Math.max(...days.map((x) => x.hi)) };

  const basics = (x: (typeof days)[number]) => (
    <dl className="kv">
      <div>
        <dt>Regen</dt>
        <dd>{mm(x.rain)}</dd>
      </div>
      <div>
        <dt>Böen bis</dt>
        <dd>{fmt0(x.gust)} km/h</dd>
      </div>
      <div>
        <dt>Sonne</dt>
        <dd>
          {hhmm(x.sunrise)} – {hhmm(x.sunset)}
        </dd>
      </div>
      <div>
        <dt>Wetter</dt>
        <dd>{x.cond.text}</dd>
      </div>
    </dl>
  );

  const next = days.slice(0, AGREEMENT_DAYS);
  const later = days.slice(AGREEMENT_DAYS);

  return (
    <>
      <section className="block" aria-labelledby="next-title">
        <h2 id="next-title" className="block-title">
          Nächste Tage
        </h2>
        {next.map((x, k) => {
          const a = agreement.find((g) => g.date === x.date) ?? null;
          const conf = a ? dayConfidence(a) : null;
          return (
            <DayRow
              key={x.date}
              name={relativeDayName(x.date, today)}
              date=""
              cond={x.cond}
              lo={x.lo}
              hi={x.hi}
              scale={scale}
              open={k === 0}
              trailing={<ConfidenceDots level={conf?.level ?? null} models={a?.members.length} />}
            >
              {basics(x)}
              {a && <AgreementDetail day={a} eps={epsDays.find((e) => e.date === x.date) ?? null} />}
            </DayRow>
          );
        })}
        {hires && (
          <details className="fold" onToggle={(e) => setShowDetails((e.target as HTMLDetailsElement).open)}>
            <summary>Stündlicher Verlauf &amp; Einzelmodelle</summary>
            {showDetails && (
              <Suspense fallback={<p className="note">Wird geladen …</p>}>
                <ModelDetails hires={hires} eps={eps} days={agreement} />
              </Suspense>
            )}
          </details>
        )}
      </section>

      <section className="block" aria-labelledby="later-title">
        <h2 id="later-title" className="block-title">
          Bis {formatDayShort(days[days.length - 1].date).split(' ')[1]} · ECMWF
        </h2>
        {later.map((x) => (
          <DayRow
            key={x.date}
            name={relativeDayName(x.date, today)}
            date={formatDayShort(x.date).split(' ')[1]}
            cond={x.cond}
            lo={x.lo}
            hi={x.hi}
            scale={scale}
            trailing={<span className="rain-amount">{(x.rain ?? 0) >= 0.1 ? `${fmt1(x.rain)} mm` : ''}</span>}
          >
            {basics(x)}
          </DayRow>
        ))}
      </section>
    </>
  );
}
