import { useEffect, useMemo, useState } from 'react';
import { fetchMinutely15 } from '../lib/api';
import { WORKPLACES } from '../lib/basemap';
import {
  best,
  DIRECTIONS,
  DURATIONS,
  isDry,
  modelOptions,
  radarOptions,
  route as makeRoute,
  wetness,
  type DirectionId,
  type Duration,
  type Option,
  type Slot,
  type Trip,
  windEffect,
} from '../lib/commute';
import { fmt1 } from '../lib/format';
import { fromKm, type Km } from '../lib/geo';
import type { RadarData } from '../lib/radar';
import { clock } from '../lib/time';
import { WeatherIcon } from './Icon';

/** Settings used to be stored on the device; remove them once so nobody inherits someone else's choice. */
function forgetOldSettings() {
  try {
    localStorage.removeItem('wetter2000.commute');
  } catch {
    /* storage unavailable */
  }
}

interface Choice {
  work: string | null;
  dir: DirectionId | null;
  duration: Duration | null;
}

const EMPTY: Choice = { work: null, dir: null, duration: null };

interface Props {
  radar: RadarData | null;
  onRoute: (r: Km[] | null) => void;
  /** Controlled from the header button („Komme ich trocken an?“). */
  open: boolean;
  onClose: () => void;
}

/** Header button that opens the commute check. */
export function CommuteButton({ onOpen, open }: { onOpen: () => void; open: boolean }) {
  return (
    <button type="button" className="commute-cta" aria-expanded={open} onClick={onOpen}>
      <span>Komme ich trocken an?</span>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function Commute({ radar, onRoute, open, onClose }: Props) {
  const setOpen = (v: boolean) => {
    if (!v) onClose();
  };
  const [editing, setEditing] = useState(false);
  const [trip, setTrip] = useState<Trip>(() => (new Date().getHours() < 12 ? 'hin' : 'heim'));
  const [choice, setChoice] = useState<Choice>(EMPTY);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [now, setNow] = useState(() => new Date());

  const workplace = WORKPLACES.find((w) => w.id === choice.work) ?? null;
  const ready = workplace != null && choice.dir != null && choice.duration != null;
  const route = useMemo(
    () => (ready ? makeRoute(workplace!.at, choice.dir!, choice.duration!, trip) : null),
    [ready, workplace, choice, trip],
  );

  useEffect(() => onRoute(open && route ? route : null), [open, route, onRoute]);

  // Every opening starts fresh: nothing from a previous check is kept.
  useEffect(() => {
    if (!open) return;
    forgetOldSettings();
    setNow(new Date());
    setChoice(EMPTY);
    setSlots(null);
    setTrip(new Date().getHours() < 12 ? 'hin' : 'heim');
    setEditing(true);
  }, [open]);

  // Model data for departures beyond the nowcast, fetched for the route midpoint.
  useEffect(() => {
    if (!open || !route) return;
    let alive = true;
    const mid: Km = [(route[0][0] + route[1][0]) / 2, (route[0][1] + route[1][1]) / 2];
    const [lat, lon] = fromKm(mid);
    fetchMinutely15(lat, lon)
      .then((d) => {
        if (!alive) return;
        setSlots(
          d.minutely_15.time.map((t, i) => ({
            // Local Munich time without offset → interpret via the radar-independent clock.
            start: localToDate(t),
            mm15: d.minutely_15.precipitation[i] ?? 0,
            wind: d.minutely_15.wind_speed_10m?.[i] ?? null,
            windDir: d.minutely_15.wind_direction_10m?.[i] ?? null,
            gust: d.minutely_15.wind_gusts_10m?.[i] ?? null,
          })),
        );
      })
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
    };
  }, [open, route]);

  const options = useMemo(() => {
    if (!route || !choice.duration) return [] as Option[];
    const r = radar ? radarOptions(radar, route, choice.duration, now) : [];
    const lastRadar = r.length ? r[r.length - 1].depart : -15;
    const m = slots ? modelOptions(slots, choice.duration, now, lastRadar + 15) : [];
    return [...r, ...m];
  }, [radar, route, choice.duration, slots, now]);

  const radarOnly = options.filter((o) => o.source === 'radar');
  const first = options[0] ?? null;
  const pick = best(radarOnly) ?? best(options);
  const pickAll = best(options);

  // Wind for the departure the verdict talks about (now, or the suggested later one).
  const windDep = first && !isDry(first) && pick && pick.depart > 0 ? pick : first;
  const wind = slots && route && windDep && choice.duration ? windEffect(slots, route, windDep.departAt, choice.duration) : null;

  const update = (v: Partial<Choice>) => setChoice((s) => ({ ...s, ...v }));

  if (!open) return null;

  return (
    <section className="commute" aria-label="Komme ich trocken an?">
      <div className="commute-head">
        <div className="seg" role="radiogroup" aria-label="Richtung der Fahrt">
          {(['hin', 'heim'] as Trip[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={trip === t} onClick={() => setTrip(t)}>
              {t === 'hin' ? 'Hin' : 'Heim'}
            </button>
          ))}
        </div>
        <button type="button" className="round" onClick={() => setOpen(false)} aria-label="Schließen">
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {(editing || !ready) && (
        <div className="commute-setup">
          <p className="setup-q">Wo ist die Arbeit?</p>
          <div className="seg wide" role="radiogroup" aria-label="Arbeitsort">
            {WORKPLACES.map((w) => (
              <button key={w.id} type="button" role="radio" aria-checked={choice.work === w.id} onClick={() => update({ work: w.id })}>
                {w.name}
              </button>
            ))}
          </div>
          <p className="setup-q">In welcher Richtung liegt das Zuhause von der Arbeit aus?</p>
          <div className="compass" role="radiogroup" aria-label="Richtung des Zuhauses">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={choice.dir === d.id}
                aria-label={d.label}
                className="needle"
                style={{ transform: `rotate(${d.deg}deg) translateY(-62px) rotate(${-d.deg}deg)` }}
                onClick={() => update({ dir: d.id })}
              >
                {d.id}
              </button>
            ))}
            <span className="compass-center" aria-hidden="true">
              {choice.dir && (
                <i style={{ transform: `rotate(${DIRECTIONS.find((d) => d.id === choice.dir)!.deg}deg)` }} />
              )}
            </span>
          </div>
          <p className="setup-q">Wie lange fährst du (Minuten)?</p>
          <div className="seg wide" role="radiogroup" aria-label="Fahrzeit">
            {DURATIONS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={choice.duration === m} aria-label={`${m} Minuten`} onClick={() => update({ duration: m })}>
                {m}
              </button>
            ))}
          </div>
          <p className="note">Gerechnet mit 20 km/h auf direkter Linie. Es wird nichts gespeichert.</p>
          {ready && (
            <button type="button" className="primary" onClick={() => setEditing(false)}>
              Prüfen
            </button>
          )}
        </div>
      )}

      {ready && !editing && (
        <div className="commute-result" aria-live="polite">
          {!radar ? (
            <p className="note">Radar wird geladen …</p>
          ) : first ? (
            <>
              <p className={`verdict ${isDry(first) ? 'dry' : 'wet'}`}>
                {isDry(first) ? 'Trocken, los!' : `Jetzt los: ${wetness(first)}`}
              </p>
              <p className="verdict-sub">
                {isDry(first)
                  ? `Die nächsten ${choice.duration} Minuten bleibt es auf der Strecke trocken.`
                  : `Ca. ${fmt1(first.mm)} mm unterwegs.`}{' '}
                {!isDry(first) && pick && pick.depart > 0 && (
                  <>
                    Besser <strong>{clock(pick.departAt)}</strong> los: {wetness(pick)}
                    {pick.source === 'modell' ? ' (laut Modell)' : ''}.
                  </>
                )}
                {!isDry(first) && pick && pick.depart === 0 && pickAll && pickAll.depart > 0 && (
                  <>
                    In der nächsten halben Stunde wird es nicht besser, laut Modell trockener ab{' '}
                    <strong>{clock(pickAll.departAt)}</strong>.
                  </>
                )}
                {!isDry(first) && pick && pick.depart === 0 && (!pickAll || pickAll.depart === 0) && (
                  <>Später wird es nicht besser.</>
                )}
              </p>
              {wind && (
                <p className={`wind-line ${wind.kind}`}>
                  <WeatherIcon name="wind" className="wind-ic" />
                  <span>
                    <span className="wind-main">{wind.label}</span>
                    {wind.gust != null && wind.gust >= 25 && (
                      <span className={wind.gust >= 40 ? 'wind-gust strong' : 'wind-gust'}>
                        , Böen bis {Math.round(wind.gust)} km/h
                      </span>
                    )}
                    {(wind.kind === 'head' || wind.kind === 'tail') && wind.deltaMin !== 0
                      ? ` · ca. ${wind.deltaMin > 0 ? '+' : '−'}${Math.abs(wind.deltaMin)} min (grob)`
                      : ''}
                    {windDep !== first ? ` · bei Abfahrt ${clock(windDep.departAt)}` : ''}
                  </span>
                </p>
              )}
              <ol className="departures" aria-label="Abfahrtszeiten">
                {options.map((o) => (
                  <li
                    key={o.depart}
                    className={`${o.source} ${isDry(o) ? 'dry' : o.mm < 0.3 ? 'drops' : o.mm < 1 ? 'wet' : 'soaked'} ${
                      o === pick ? 'pick' : ''
                    }`}
                    title={`${clock(o.departAt)}: ${wetness(o)}, ${fmt1(o.mm)} mm`}
                  >
                    <i />
                    <span>{o.depart === 0 ? 'jetzt' : o.depart % 30 === 0 ? clock(o.departAt) : ''}</span>
                  </li>
                ))}
              </ol>
              <p className="note">
                {trip === 'hin' ? `Zuhause → ${workplace!.name}` : `${workplace!.name} → Zuhause`} · Zuhause im{' '}
                {DIRECTIONS.find((d) => d.id === choice.dir)!.label}, {choice.duration} min · Radar bis{' '}
                {radarOnly.length ? clock(radarOnly[radarOnly.length - 1].departAt) : '–'}, danach Modell (blasser).{' '}
                <button type="button" className="link" onClick={() => setEditing(true)}>
                  ändern
                </button>
              </p>
            </>
          ) : (
            <p className="note">Für diese Fahrzeit liegen gerade keine Radardaten vor.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** "2026-11-17T15:15" in Munich local time → Date. */
function localToDate(local: string): Date {
  const guess = new Date(`${local}:00Z`);
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const [h, m] = fmt.format(guess).split(':').map(Number);
  const offsetMin = (h * 60 + m - (guess.getUTCHours() * 60 + guess.getUTCMinutes()) + 1440) % 1440;
  return new Date(guess.getTime() - (offsetMin > 720 ? offsetMin - 1440 : offsetMin) * 60000);
}
