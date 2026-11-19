import { useState } from 'react';
import { About } from './components/About';
import { Logo, Skyline } from './components/Logo';
import { Commute, CommuteButton } from './components/Commute';
import type { Km } from './lib/geo';
import { Days } from './components/Days';
import { Hourly } from './components/Hourly';
import { NowHead, NowMore } from './components/Now';
import { GrowelaPanel } from './components/Growela';
import { Radar } from './components/Radar';
import { usePressure } from './lib/usePressure';
import { useTrend } from './lib/useTrend';
import { Trend14 } from './components/Trend14';
import { useRadar } from './lib/useRadar';
import { useWeather } from './lib/useWeather';

export default function App() {
  const w = useWeather();
  const radar = useRadar();
  const pressure = usePressure();
  const trend = useTrend();
  const [route, setRoute] = useState<Km[] | null>(null);
  const [commute, setCommute] = useState(false);
  const [gw, setGw] = useState(false);
  const [more, setMore] = useState(false);
  const reload = () => {
    w.reload();
    radar.reload();
  };
  const stand = w.updatedAt ? w.updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
  const errors = [
    w.ecmwf.error && 'Vorhersage',
    w.hires.error && 'Modellvergleich',
    w.current.error && !w.ecmwf.data && 'aktuelle Werte',
  ].filter(Boolean);

  return (
    <>
    {/* Brand bar (blue): logo, claim, refresh. */}
    <header className="masthead instrument">
      <Skyline />
      <div className="masthead-in">
        <div className="ins-top">
          <Logo size={34} />
          <p className="masthead-name">
            Wetter<b>2000</b>
          </p>
          <p className="masthead-claim">Föhnomenal genial.</p>
          <button
            type="button"
            className="ins-refresh"
            onClick={reload}
            disabled={w.loading}
            aria-label={w.loading ? 'Lädt …' : `Aktualisieren${stand ? ` (Stand ${stand} Uhr)` : ''}`}
            title={stand ? `Aktualisieren · Stand ${stand}` : 'Aktualisieren'}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className={w.loading ? 'spin' : undefined}>
              <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.6h-3.6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
    {/* Current reading and all actions directly below the brand bar, on the page background. */}
    <section className="ins-now" aria-label="Jetzt">
      <div className="ins-now-in">
        {w.loading && !w.updatedAt ? (
          <div className="loading" aria-live="polite">
            Lade Wetterdaten …
          </div>
        ) : (
          <NowHead current={w.current.data} ecmwf={w.ecmwf.data} />
        )}
        <CommuteButton open={commute} onOpen={() => setCommute((v) => !v)} />
        <div className="ins-actions">
          <button type="button" className="ins-pill" aria-expanded={gw} aria-controls="growela" title="Großwetterlage" onClick={() => setGw((v) => !v)}>
            GroWeLa
          </button>
          <button type="button" className="ins-pill" aria-expanded={more} aria-controls="now-more" onClick={() => setMore((v) => !v)}>
            Mehr zu jetzt
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </section>
    <div className="app">
      <Commute radar={radar.data} onRoute={setRoute} open={commute} onClose={() => setCommute(false)} />
      {gw && <GrowelaPanel pressure={pressure} foehn={w.foehn.data} />}
      {more && <NowMore current={w.current.data} ecmwf={w.ecmwf.data} />}

      <Hourly
        hires={w.hires.data}
        ecmwf={w.ecmwf.data}
        radar={radar.data}
        currentTemp={w.current.data?.weather.temperature ?? w.ecmwf.data?.current?.temperature_2m ?? null}
      />

      <Radar data={radar.data} error={radar.error} route={route} />

      <Trend14 data={trend} ecmwf={w.ecmwf.data} />

      {errors.length > 0 && (
        <p className="error" role="alert">
          {errors.join(', ')} gerade nicht erreichbar. Es wird automatisch erneut versucht.
        </p>
      )}

      <Days ecmwf={w.ecmwf.data} hires={w.hires.data} eps={w.eps.data} pressure={pressure} foehn={w.foehn.data} euEps={w.euEps.data} aifs={w.aifs.data} />

      <About
        updatedAt={w.updatedAt}
        loading={w.loading}
        onReload={reload}
      />
    </div>
    </>
  );
}
