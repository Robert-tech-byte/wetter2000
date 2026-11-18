import { lazy, Suspense, useMemo } from 'react';
import type { FoehnSeries } from '../lib/api';
import { analyzeFoehn } from '../lib/foehn';
import { classify, meaning, reasons, trend } from '../lib/growela';
import { compass } from '../lib/hourly';
import type { PressureData } from '../lib/pressure';
import { localHourKey } from '../lib/time';

const PressureMap = lazy(() => import('./PressureMap').then((m) => ({ default: m.PressureMap })));

const FROM: Record<string, string> = {
  NO: 'nordöstlicher',
  SO: 'südöstlicher',
  SW: 'südwestlicher',
  NW: 'nordwestlicher',
};

interface Props {
  pressure: PressureData | null;
  foehn: { munich: FoehnSeries; bozen: FoehnSeries } | null;
}

/** Explains today's large-scale weather pattern ("Großwetterlage") and what it means for Munich. */
export function GrowelaPanel({ pressure, foehn }: Props) {
  const today = localHourKey().slice(0, 10);
  const list = useMemo(() => {
    if (!pressure) return [];
    const start = pressure.days.findIndex((d) => d.date >= today);
    return pressure.days
      .slice(Math.max(0, start), Math.max(0, start) + 4)
      .map((d) => classify(pressure, d.date))
      .filter((g): g is NonNullable<typeof g> => g != null);
  }, [pressure, today]);
  const foehnToday = useMemo(
    () => (foehn ? analyzeFoehn(foehn.munich, foehn.bozen).some((d) => d.date === today && d.active) : false),
    [foehn, today],
  );

  if (!pressure) return <p className="note">Die Luftdruckdaten für die Großwetterlage sind gerade nicht verfügbar.</p>;
  const g = list[0];
  if (!g) return <p className="note">Für heute liegt keine Einordnung vor.</p>;
  const t = trend(list);

  return (
    <div className="growela" id="growela" role="region" aria-label="Großwetterlage">
      <p className="gw-kicker">Großwetterlage heute, 12 Uhr</p>
      <h3 className="gw-name">{g.name}</h3>
      <p className="gw-flow">
        {g.fromDeg == null
          ? 'Kaum Luftdruckgefälle über Süddeutschland, die Luft steht weitgehend.'
          : `Die Luft strömt aus ${FROM[g.sector]} Richtung nach München (genauer: aus ${compass(g.fromDeg)}).`}{' '}
        {g.highs[0] && `Hoch über ${g.highs[0].label} (${g.highs[0].value} hPa)`}
        {g.highs[0] && g.lows[0] && ', '}
        {g.lows[0] && `Tief über ${g.lows[0].label} (${g.lows[0].value} hPa)`}
        {(g.highs[0] || g.lows[0]) && '.'}
      </p>
      <h4 className="gw-sub">Warum ist das Wetter so?</h4>
      <dl className="gw-why">
        {reasons(list, foehnToday).map((r) => (
          <div key={r.title}>
            <dt>{r.title}</dt>
            <dd>{r.text}</dd>
          </div>
        ))}
      </dl>
      <h4 className="gw-sub">Was heißt das für München?</h4>
      <ul className="gw-meaning">
        {meaning(g, foehnToday).map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      {t && <p className="gw-trend">{t}</p>}
      <Suspense fallback={<p className="note">Karte wird geladen …</p>}>
        <PressureMap data={pressure} date={g.date} />
      </Suspense>
      <p className="note">
        Vereinfachte Einordnung aus dem ECMWF-Luftdruck am Boden. Echte Klassifikationen (z. B. DWD) nutzen zusätzlich
        Höhendaten; Details unter „Quellen &amp; Methode“.
      </p>
    </div>
  );
}
