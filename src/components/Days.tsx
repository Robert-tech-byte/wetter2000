import { lazy, Suspense, useMemo, useState } from "react";
import type { PressureData } from "../lib/pressure";
import type { FoehnSeries } from "../lib/api";
import { analyzeFoehn, type FoehnDay } from "../lib/foehn";
import { compass } from "../lib/hourly";

const PressureMap = lazy(() =>
  import("./PressureMap").then((m) => ({ default: m.PressureMap })),
);
import {
  analyzeDays,
  dayConfidence,
  median,
  rainConsensus,
  type DayAgreement,
  type ConfidenceLevel,
} from "../lib/agreement";
import type { EcmwfForecast, MemberSet, ModelSeries } from "../lib/api";
import { pairDays, type PairDay } from "../lib/pair";
import {
  AGREEMENT_DAYS,
  AIFS_MODEL,
  EPS_MODEL,
  EU_EPS_MODEL,
  HIRES_MODELS,
  TEMP_TOLERANCE,
} from "../lib/config";
import { fmt0, fmt1, mm, pct } from "../lib/format";
import {
  formatDayShort,
  hhmm,
  localHourKey,
  relativeDayName,
} from "../lib/time";
import { describeWeather } from "../lib/weatherCodes";
import { ConfidenceDots } from "./Confidence";
import { DayChart, type HourPoint } from "./DayChart";
import { DayRow, type Scale } from "./DayRow";

interface Props {
  ecmwf: EcmwfForecast | null;
  hires: MemberSet | null;
  eps: MemberSet | null;
  pressure: PressureData | null;
  foehn: { munich: FoehnSeries; bozen: FoehnSeries } | null;
  euEps: MemberSet | null;
  aifs: ModelSeries | null;
}

/** An ensemble day counts only if enough runs cover it. */
const MIN_EPS_RUNS = 10;
const level = (v: number | null): ConfidenceLevel | null =>
  v == null ? null : v >= 0.8 ? 3 : v >= 0.5 ? 2 : 1;
const WORD: Record<ConfidenceLevel, string> = {
  3: "sicher",
  2: "ziemlich sicher",
  1: "unsicher",
};
const span = (r: [number, number] | null, f: (v: number) => string) =>
  r ? `${f(r[0])} – ${f(r[1])}` : "–";

/** Hourly median (+ spread) of all models for one calendar day. */
function modelHours(set: MemberSet, date: string): HourPoint[] {
  const out: HourPoint[] = [];
  set.time.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const temps = set.members
      .map((m) => m.temperature[i])
      .filter((v): v is number => v != null);
    const rains = set.members
      .map((m) => m.precipitation[i])
      .filter((v): v is number => v != null);
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

type Band = (
  time: string,
  temp: number | null,
) => { lo: number; hi: number } | null;

/** ECMWF main run (the values of the row) with an optional uncertainty band per hour. */
function ecmwfHours(
  e: EcmwfForecast,
  date: string,
  band?: Band | null,
): HourPoint[] {
  return e.hourly.time
    .map((t, i) => {
      const temp = e.hourly.temperature_2m[i];
      return {
        time: t,
        temp,
        rain: e.hourly.precipitation[i],
        ...(band?.(t, temp) ?? {}),
      };
    })
    .filter((p) => p.time.startsWith(date));
}

/** Band = range between the ECMWF line and a second model. */
function pairBand(other: ModelSeries): Band {
  const idx = new Map(other.time.map((t, i) => [t, i]));
  return (t, temp) => {
    const j = idx.get(t);
    const o = j != null ? other.temperature[j] : null;
    return temp != null && o != null
      ? { lo: Math.min(temp, o), hi: Math.max(temp, o) }
      : null;
  };
}

/** Band = 10th–90th percentile of an ensemble. */
function epsBand(set: MemberSet): Band {
  const idx = new Map(set.time.map((t, i) => [t, i]));
  return (t) => {
    const j = idx.get(t);
    if (j == null) return null;
    const v = set.members
      .map((m) => m.temperature[j])
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    if (v.length < 10) return null;
    const q = (p: number) => v[Math.round((v.length - 1) * p)];
    return { lo: q(0.1), hi: q(0.9) };
  };
}

const ecmwfSeries = (e: EcmwfForecast): ModelSeries => ({
  time: e.hourly.time,
  temperature: e.hourly.temperature_2m,
  precipitation: e.hourly.precipitation,
});

function FoehnNote({ day }: { day: FoehnDay }) {
  return (
    <p className="foehn-note">
      <span className="foehn">Föhn</span>
      <span>
        Wahrscheinlich laut Modell: Druck Bozen–München bis {fmt0(day.maxDiff)}{" "}
        hPa
        {day.withUpperWind && day.dir700 != null
          ? `, Höhenwind aus ${compass(day.dir700)}`
          : ""}
        {day.minHumidity != null
          ? `, Luftfeuchte bis ${fmt0(day.minHumidity)} %`
          : ""}
        . Gute Fernsicht auf die Alpen, mild und trocken.
      </span>
    </p>
  );
}

/** Rain column: probability (models, first 3 days) and amount. */
function RainCell({
  p,
  mmValue,
}: {
  p: number | null;
  mmValue: number | null;
}) {
  const amount =
    mmValue != null && mmValue >= 0.1 ? `${fmt1(mmValue)} mm` : null;
  if (p == null && !amount) return null;
  return (
    <span
      className={`rain-cell ${(p ?? 0) >= 0.5 || (p == null && amount) ? "wet" : ""}`}
    >
      {p != null && <b>{fmt0(p * 100)} %</b>}
      {amount && <small>{amount}</small>}
    </span>
  );
}

function Certainty({
  day,
  unit = "Modelle",
  source,
}: {
  day: DayAgreement;
  unit?: "Modelle" | "Läufe";
  source?: string;
}) {
  const n = day.members.length;
  const inTol =
    day.tempAgreement != null ? Math.round(day.tempAgreement * n) : null;
  const rainC = rainConsensus(day.rainProbability);
  const lt = level(day.tempAgreement);
  const lr = level(rainC);
  return (
    <>
      <dl className="certainty">
        <div>
          <dt>Temperatur</dt>
          <dd>
            <span className="cert-line">
              <ConfidenceDots level={lt} />
              <strong>{lt ? WORD[lt] : "–"}</strong>
            </span>
            <span className="cert-why">
              {inTol ?? "–"} von {n} {unit === "Läufe" ? "Läufen" : "Modellen"}{" "}
              innerhalb ±{fmt1(TEMP_TOLERANCE)} °C
            </span>
          </dd>
        </div>
        <div>
          <dt>Regen</dt>
          <dd>
            <span className="cert-line">
              <ConfidenceDots level={lr} />
              <strong>{lr ? WORD[lr] : "–"}</strong>
            </span>
            <span className="cert-why">
              {day.rainMembers === 0
                ? `alle ${n} ${unit} trocken`
                : day.rainMembers === n
                  ? `alle ${n} ${unit} mit Regen`
                  : `${day.rainMembers} von ${n} ${unit === "Läufe" ? "Läufen" : "Modellen"} mit Regen`}
            </span>
          </dd>
        </div>
      </dl>
      {source && <p className="note">{source}</p>}
    </>
  );
}

/** Days after ICON-EU-EPS: ECMWF main run (IFS) against ECMWF AIFS. */
function PairCertainty({ p }: { p: PairDay }) {
  const deg = (v: number) => `${fmt1(v)}°`;
  const rainText = p.rainAgree
    ? p.ecmwf.rains
      ? "beide Modelle mit Regen"
      : "beide Modelle trocken"
    : p.other.rains
      ? "nur AIFS mit Regen"
      : "nur IFS mit Regen";
  return (
    <>
      <dl className="certainty">
        <div>
          <dt>Temperatur</dt>
          <dd>
            <span className="cert-line">
              <ConfidenceDots level={p.tempLevel} />
              <strong>{WORD[p.tempLevel]}</strong>
            </span>
            <span className="cert-why">
              AIFS in {p.inTol} von {p.hours} Stunden innerhalb ±
              {fmt1(TEMP_TOLERANCE)} °C vom Hauptlauf (IFS)
            </span>
          </dd>
        </div>
        <div>
          <dt>Regen</dt>
          <dd>
            <span className="cert-line">
              <ConfidenceDots level={p.rainLevel} />
              <strong>{WORD[p.rainLevel]}</strong>
            </span>
            <span className="cert-why">{rainText}</span>
          </dd>
        </div>
      </dl>
      <table className="mini">
        <thead>
          <tr>
            <th>Modell</th>
            <th>Tief / Hoch</th>
            <th>Regen</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              ECMWF IFS <small>9 km, Hauptlauf</small>
            </td>
            <td>
              {deg(p.ecmwf.tMin)} / {deg(p.ecmwf.tMax)}
            </td>
            <td className={p.ecmwf.rains ? "wet" : ""}>
              {mm(p.ecmwf.rainSum)}
            </td>
          </tr>
          <tr>
            <td>
              {AIFS_MODEL.name} <small>{AIFS_MODEL.resolutionKm} km, KI</small>
            </td>
            <td>
              {deg(p.other.tMin)} / {deg(p.other.tMax)}
            </td>
            <td className={p.other.rains ? "wet" : ""}>
              {mm(p.other.rainSum)}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="note">
        Ab hier nur noch 2 Modelle im Vergleich, beide von ECMWF (gleicher
        Startzustand, aber Physik gegen KI): weniger belastbar als die ersten
        Tage.
      </p>
    </>
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
  eps: { name: string; members: number; day: DayAgreement } | null;
  basics: {
    rain: number | null;
    gust: number | null;
    sunrise: string;
    sunset: string;
  };
  pressure: PressureData | null;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="fold power"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
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
                  <tr key={m.id} className={s ? "" : "na"}>
                    <td>
                      {m.name}{" "}
                      <small>
                        {String(m.resolutionKm).replace(".", ",")} km
                      </small>
                    </td>
                    <td>
                      {s
                        ? `${fmt1(s.tMin)}° / ${fmt1(s.tMax)}°`
                        : "reicht nicht so weit"}
                    </td>
                    <td className={s?.rains ? "wet" : ""}>
                      {s ? mm(s.rainSum) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="note">
            {eps
              ? `${eps.name} (${eps.members} Läufe): Temperatur ${pct(eps.day.tempAgreement)} innerhalb ±${fmt1(TEMP_TOLERANCE)} °C, Regen in ${pct(eps.day.rainProbability)} der Läufe.`
              : `${EPS_MODEL.name} und ${EU_EPS_MODEL.name} reichen nicht bis zu diesem Tag.`}
          </p>
        </>
      )}
    </details>
  );
}

export function Days({
  ecmwf,
  hires,
  eps,
  pressure,
  foehn,
  euEps,
  aifs,
}: Props) {
  const nowKey = localHourKey();
  const today = nowKey.slice(0, 10);

  const agreement = useMemo(
    () =>
      hires
        ? analyzeDays(hires.time, hires.members, nowKey, AGREEMENT_DAYS)
        : [],
    [hires, nowKey],
  );
  const foehnDays = useMemo(
    () => (foehn ? analyzeFoehn(foehn.munich, foehn.bozen) : []),
    [foehn],
  );
  const epsDays = useMemo(
    () =>
      eps ? analyzeDays(eps.time, eps.members, nowKey, AGREEMENT_DAYS) : [],
    [eps, nowKey],
  );

  const euDays = useMemo(
    () =>
      euEps
        ? analyzeDays(euEps.time, euEps.members, nowKey, EU_EPS_MODEL.fetchDays)
        : [],
    [euEps, nowKey],
  );
  const pairs = useMemo(
    () =>
      ecmwf && aifs
        ? pairDays(
            ecmwfSeries(ecmwf),
            aifs,
            ecmwf.daily.time.slice(AGREEMENT_DAYS),
          )
        : [],
    [ecmwf, aifs],
  );

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
    .filter(
      (x): x is typeof x & { lo: number; hi: number } =>
        x.lo != null && x.hi != null,
    );
  const scale: Scale = {
    lo: Math.min(...days.map((x) => x.lo)),
    hi: Math.max(...days.map((x) => x.hi)),
  };

  return (
    <section className="block" aria-labelledby="days-title">
      <h2 id="days-title" className="block-title">
        Tage
      </h2>
      {days.map((x, k) => {
        const a =
          k < AGREEMENT_DAYS
            ? (agreement.find((g) => g.date === x.date) ?? null)
            : null;
        const conf = a ? dayConfidence(a) : null;
        // ICON-EU-EPS where enough runs cover the day, afterwards IFS against AIFS.
        const eu =
          euDays.find(
            (g) => g.date === x.date && g.members.length >= MIN_EPS_RUNS,
          ) ?? null;
        const ea = k >= AGREEMENT_DAYS ? eu : null;
        const euConf = ea ? dayConfidence(ea) : null;
        const pair =
          k >= AGREEMENT_DAYS && !ea
            ? (pairs.find((p) => p.date === x.date) ?? null)
            : null;
        const d2 =
          epsDays.find((e) => e.date === x.date && e.members.length) ?? null;
        const epsInfo = d2
          ? { name: EPS_MODEL.name, members: d2.members.length, day: d2 }
          : eu
            ? { name: EU_EPS_MODEL.name, members: eu.members.length, day: eu }
            : null;
        const hours =
          a && hires
            ? modelHours(hires, x.date)
            : ecmwfHours(
                ecmwf,
                x.date,
                ea && euEps
                  ? epsBand(euEps)
                  : pair && aifs
                    ? pairBand(aifs)
                    : null,
              );
        const f = foehnDays.find((d) => d.date === x.date && d.active) ?? null;
        return (
          <DayRow
            key={x.date}
            id={`day-${x.date}`}
            name={relativeDayName(x.date, today)}
            date={
              // Heute/Morgen stand alone; from the third day on weekday + date like all rows.
              k < 2 ? "" : formatDayShort(x.date).split(" ")[1]
            }
            badge={
              f ? (
                <span className="foehn" title="Föhn wahrscheinlich">
                  Föhn
                </span>
              ) : null
            }
            cond={x.cond}
            lo={x.lo}
            hi={x.hi}
            scale={scale}
            rain={
              a ? (
                <RainCell p={a.rainProbability} mmValue={a.rainSumMedian} />
              ) : ea ? (
                <RainCell p={ea.rainProbability} mmValue={ea.rainSumMedian} />
              ) : (
                <RainCell p={null} mmValue={x.rain} />
              )
            }
            trailing={
              a ? (
                <ConfidenceDots
                  level={conf?.level ?? null}
                  models={a.members.length}
                />
              ) : ea ? (
                <ConfidenceDots level={euConf?.level ?? null} />
              ) : pair ? (
                <ConfidenceDots level={pair.level} models={2} />
              ) : null
            }
          >
            <DayChart
              points={hours}
              nowKey={x.date === today ? nowKey : undefined}
            />
            {a ? (
              <Certainty day={a} />
            ) : ea ? (
              <Certainty
                day={ea}
                unit="Läufe"
                source={`${EU_EPS_MODEL.name} (${EU_EPS_MODEL.provider}, ${ea.members.length} Läufe, ~${fmt1(EU_EPS_MODEL.resolutionKm)} km). Die Fläche im Diagramm zeigt, wo 80 % der Läufe liegen; Werte in der Zeile: ECMWF-Hauptlauf.`}
              />
            ) : pair ? (
              <PairCertainty p={pair} />
            ) : (
              <p className="note">
                ECMWF IFS. Für diesen Tag liegt kein Vergleichsmodell vor.
              </p>
            )}
            {f && <FoehnNote day={f} />}
            <PowerDetails
              day={a}
              eps={epsInfo}
              basics={x}
              pressure={pressure}
              date={x.date}
            />
          </DayRow>
        );
      })}
    </section>
  );
}
