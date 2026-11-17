import { lazy, Suspense, useMemo, useState } from 'react';
import type { PressureData } from '../lib/pressure';
import type { FoehnSeries } from '../lib/api';
import { analyzeFoehn, type FoehnDay } from '../lib/foehn';
import { compass } from '../lib/hourly';

const PressureMap = lazy(() => import('./PressureMap').then((m) => ({ default: m.PressureMap })));
import { analyzeDays, dayConfidence, median, rainConsensus, type DayAgreement, type ConfidenceLevel } from '../lib/agreement';
import type { EcmwfForecast, MemberSet } from '../lib/api';
import { AGREEMENT_DAYS, EPS_MODEL, HIRES_MODELS, TEMP_TOLERANCE } from '../lib/config';
import { fmt0, fmt1, mm, pct } from '../lib/format';
import { formatDayShort, hhmm, localHourKey, relativeDayName } from '../lib/time';
import { describeWeather } from '../lib/weatherCodes';
import { ConfidenceDots } from './Confidence';
import { DayChart, type HourPoint } from './DayChart';
import { DayRow, type Scale } from './DayRow';

interface Props {
  ecmwf: EcmwfForecast | null;
  hires: MemberSet | null;
  eps: MemberSet | null;
  pressure: PressureData | null;
  foehn: { munich: FoehnSeries; bozen: FoehnSeries } | null;
}

const level = (v: number | null): ConfidenceLevel | null => (v == null ? null : v >= 0.8 ? 3 : v >= 0.5 ? 2 : 1);
const WORD: Record<ConfidenceLevel, string> = { 3: 'sicher', 2: 'ziemlich sicher', 1: 'unsicher' };
const span = (r: [number, number] | null, f: (v: number) => string) => (r ? `${f(r[0])} – ${f(r[1])}` : '–');

/** Hourly median (+ spread) of all models for one calendar day. */
function modelHours(set: MemberSet, date: string): HourPoint[] {
  const out: HourPoint[] = [];
  set.time.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const temps = set.members.map((m) => m.temperature[i]).filter((v): v is number => v != null);
    const rains = set.members.map((m) => m.precipitation[i]).filter((v): v is number => v != null);
    out.push({
      time: t,
      temp: temps.length ? median(temps) : null,
      lo: temps.length > 1 ? Math.min(...temps) : null,
      hi: temps.length > 1 ? Math.max(...temps) : null,
      rain: rains.length ? median(rains) : null,
    });
  });
  return out;
}

function ecmwfHours(e: EcmwfForecast, date: string): HourPoint[] {
  return e.hourly.time
    .map((t, i) => ({ time: t, temp: e.hourly.temperature_2m[i], rain: e.hourly.precipitation[i] }))
    .filter((p) => p.time.startsWith(date));
}

function FoehnNote({ day }: { day: FoehnDay }) {
  return (
    <p className="foehn-note">
      <span className="foehn">Föhn</span>
      <span>
        Wahrscheinlich laut Modell: Druck Bozen–München bis {fmt0(day.maxDiff)} hPa
        {day.withUpperWind && day.dir700 != null ? `, Höhenwind aus ${compass(day.dir700)}` : ''}
        {day.minHumidity != null ? `, Luftfeuchte bis ${fmt0(day.minHumidity)} %` : ''}. Gute Fernsicht auf die Alpen, mild und
        trocken.
      </span>
    </p>
  );
}

/** Rain column: probability (models, first 3 days) and amount. */
function RainCell({ p, mmValue }: { p: number | null; mmValue: number | null }) {
  const amount = mmValue != null && mmValue >= 0.1 ? `${fmt1(mmValue)} mm` : null;
  if (p == null && !amount) return null;
  return (
    <span className={`rain-cell ${(p ?? 0) >= 0.5 || (p == null && amount) ? 'wet' : ''}`}>
      {p != null && <b>{fmt0(p * 100)} %</b>}
      {amount && <small>{amount}</small>}
    </span>
  );
}

function Certainty({ day }: { day: DayAgreement }) {
  const n = day.members.length;
  const inTol = day.tempAgreement != null ? Math.round(day.tempAgreement * n) : null;
  const rainC = rainConsensus(day.rainProbability);
  const lt = level(day.tempAgreement);
  const lr = level(rainC);
  return (
    <dl className="certainty">
      <div>
        <dt>Temperatur</dt>
        <dd>
          <span className="cert-line">
            <ConfidenceDots level={lt} />
            <strong>{lt ? WORD[lt] : '–'}</strong>
          </span>
          <span className="cert-why">
            {inTol ?? '–'} von {n} Modellen innerhalb ±{fmt1(TEMP_TOLERANCE)} °C
          </span>
        </dd>
      </div>
      <div>
        <dt>Regen</dt>
        <dd>
          <span className="cert-line">
            <ConfidenceDots level={lr} />
            <strong>{lr ? WORD[lr] : '–'}</strong>
          </span>
          <span className="cert-why">
            {day.rainMembers === 0
              ? `alle ${n} Modelle trocken`
              : day.rainMembers === n
                ? `alle ${n} Modelle mit Regen`
                : `${day.rainMembers} von ${n} Modellen mit Regen`}
          </span>
        </dd>
      </div>
    </dl>
  );
}

function PowerDetails({
  day,
  eps,
  basics,
  pressure,
  date,
}: {
  day: DayAgreement | null;
  eps: DayAgreement | null;
  basics: { rain: number | null; gust: number | null; sunrise: string; sunset: string };
  pressure: PressureData | null;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details className="fold power" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Details</summary>
      {open && pressure && (
        <Suspense fallback={<p className="note">Karte wird geladen …</p>}>
          <PressureMap data={pressure} date={date} />
        </Suspense>
      )}
      <dl className="kv">
        <div>
          <dt>Regen (ECMWF)</dt>
          <dd>{mm(basics.rain)}</dd>
        </div>
        <div>
          <dt>Böen bis</dt>
          <dd>{fmt0(basics.gust)} km/h</dd>
        </div>
        <div>
          <dt>Sonne</dt>
          <dd>
            {hhmm(basics.sunrise)} – {hhmm(basics.sunset)}
          </dd>
        </div>
        {day && (
          <>
            <div>
              <dt>Höchstwert Modelle</dt>
              <dd>{span(day.tMaxRange, (v) => `${fmt1(v)}°`)}</dd>
            </div>
            <div>
              <dt>Tiefstwert Modelle</dt>
              <dd>{span(day.tMinRange, (v) => `${fmt1(v)}°`)}</dd>
            </div>
            <div>
              <dt>Regenmenge Modelle</dt>
              <dd>{span(day.rainSumRange, (v) => fmt1(v))} mm</dd>
            </div>
          </>
        )}
      </dl>
      {day && (
        <>
          <table className="mini">
            <thead>
              <tr>
                <th>Modell</th>
                <th>Tief / Hoch</th>
                <th>Regen</th>
              </tr>
            </thead>
            <tbody>
              {HIRES_MODELS.map((m) => {
                const s = day.members.find((x) => x.id === m.id);
                return (
                  <tr key={m.id} className={s ? '' : 'na'}>
                    <td>
                      {m.name} <small>{String(m.resolutionKm).replace('.', ',')} km</small>
                    </td>
                    <td>{s ? `${fmt1(s.tMin)}° / ${fmt1(s.tMax)}°` : 'reicht nicht so weit'}</td>
                    <td className={s?.rains ? 'wet' : ''}>{s ? mm(s.rainSum) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">
            {EPS_MODEL.name} ({EPS_MODEL.members} Läufe):{' '}
            {eps && eps.members.length
              ? `Temperatur ${pct(eps.tempAgreement)} innerhalb ±${fmt1(TEMP_TOLERANCE)} °C, Regen in ${pct(eps.rainProbability)} der Läufe.`
              : 'reicht nicht bis zu diesem Tag.'}
          </p>
        </>
      )}
    </details>
  );
}

export function Days({ ecmwf, hires, eps, pressure, foehn }: Props) {
  const nowKey = localHourKey();
  const today = nowKey.slice(0, 10);

  const agreement = useMemo(
    () => (hires ? analyzeDays(hires.time, hires.members, nowKey, AGREEMENT_DAYS) : []),
    [hires, nowKey],
  );
  const foehnDays = useMemo(() => (foehn ? analyzeFoehn(foehn.munich, foehn.bozen) : []), [foehn]);
  const epsDays = useMemo(() => (eps ? analyzeDays(eps.time, eps.members, nowKey, AGREEMENT_DAYS) : []), [eps, nowKey]);

  if (!ecmwf) return null;
  const d = ecmwf.daily;
  const days = d.time
    .map((date, i) => ({
      date,
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

  return (
    <section className="block" aria-labelledby="days-title">
      <h2 id="days-title" className="block-title">
        Tage
      </h2>
      {days.map((x, k) => {
        const a = k < AGREEMENT_DAYS ? (agreement.find((g) => g.date === x.date) ?? null) : null;
        const conf = a ? dayConfidence(a) : null;
        const hours = a && hires ? modelHours(hires, x.date) : ecmwfHours(ecmwf, x.date);
        const f = foehnDays.find((d) => d.date === x.date && d.active) ?? null;
        return (
          <DayRow
            key={x.date}
            name={relativeDayName(x.date, today)}
            date={k < AGREEMENT_DAYS ? '' : formatDayShort(x.date).split(' ')[1]}
            badge={f ? <span className="foehn" title="Föhn wahrscheinlich">Föhn</span> : null}
            cond={x.cond}
            lo={x.lo}
            hi={x.hi}
            scale={scale}
            rain={
              a ? (
                <RainCell p={a.rainProbability} mmValue={a.rainSumMedian} />
              ) : (
                <RainCell p={null} mmValue={x.rain} />
              )
            }
            trailing={a ? <ConfidenceDots level={conf?.level ?? null} models={a.members.length} /> : null}
          >
            <DayChart points={hours} nowKey={x.date === today ? nowKey : undefined} />
            {a ? (
              <Certainty day={a} />
            ) : (
              <p className="note">ECMWF IFS. Wie sicher die Vorhersage ist, wird nur für die ersten 3 Tage berechnet.</p>
            )}
            {f && <FoehnNote day={f} />}
            <PowerDetails day={a} eps={epsDays.find((e) => e.date === x.date) ?? null} basics={x} pressure={pressure} date={x.date} />
          </DayRow>
        );
      })}
    </section>
  );
}
