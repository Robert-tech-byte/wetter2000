import { Agreement } from './components/Agreement';
import { CurrentWeather } from './components/CurrentWeather';
import { Forecast15 } from './components/Forecast15';
import { Radar } from './components/Radar';
import { ErrorNote, Section } from './components/Section';
import { EPS_MODEL, FORECAST_DAYS, LOCATION, TEMP_TOLERANCE } from './lib/config';
import { fmt1 } from './lib/format';
import { clock } from './lib/time';
import { useWeather } from './lib/useWeather';

export default function App() {
  const w = useWeather();

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>
            Wetter<span>2000</span>
          </h1>
          <p className="muted">{LOCATION.name}</p>
        </div>
        <div className="top-right">
          {w.updatedAt && <span className="muted small">Stand {clock(w.updatedAt)} Uhr</span>}
          <button onClick={w.reload} disabled={w.loading} aria-label="Daten neu laden">
            {w.loading ? '…' : '↻'}
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Bereiche">
        <a href="#jetzt">Jetzt</a>
        <a href="#radar">Radar</a>
        <a href="#modelle">3 Tage</a>
        <a href="#vorhersage">15 Tage</a>
      </nav>

      <main>
        <section id="jetzt" aria-label="Aktuelles Wetter">
          {w.loading && !w.updatedAt ? (
            <div className="card skeleton">Lade Wetterdaten …</div>
          ) : (
            <CurrentWeather current={w.current.data} ecmwf={w.ecmwf.data} />
          )}
        </section>

        <Section id="radar" title="Regenradar" subtitle="Letzte Stunde gemessen, nächste 60 Minuten Vorhersage (DWD)">
          <Radar />
        </Section>

        <Section
          id="modelle"
          title="Modell-Übereinstimmung"
          subtitle={`Heute bis übermorgen: Wie einig sind sich Wettermodelle ≤ 7 km und ${EPS_MODEL.name}? Temperatur-Toleranz ±${fmt1(TEMP_TOLERANCE)} °C.`}
        >
          <ErrorNote what="Die Modelldaten" error={w.hires.error} />
          <ErrorNote what={EPS_MODEL.name} error={w.eps.error} />
          {w.hires.data && <Agreement hires={w.hires.data} eps={w.eps.data} />}
        </Section>

        <Section id="vorhersage" title={`${FORECAST_DAYS}-Tage-Vorhersage`} subtitle="ECMWF IFS (Europäisches Zentrum für mittelfristige Wettervorhersage)">
          <ErrorNote what="Die ECMWF-Vorhersage" error={w.ecmwf.error} />
          {w.ecmwf.data && <Forecast15 data={w.ecmwf.data} />}
        </Section>
      </main>

      <footer className="muted small">
        <p>
          Daten: <a href="https://open-meteo.com/">Open-Meteo</a> (CC BY 4.0) mit Modellen von ECMWF, DWD, MeteoSchweiz,
          Météo-France, KNMI und DMI · <a href="https://brightsky.dev/">Bright Sky</a> mit Daten des{' '}
          <a href="https://www.dwd.de/">Deutschen Wetterdienstes</a> · Karte ©{' '}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
        </p>
        <p>Alle Angaben ohne Gewähr. Vorhersagen sind Modellrechnungen, keine amtlichen Warnungen.</p>
      </footer>
    </div>
  );
}
