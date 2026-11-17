import { useState } from 'react';
import { About } from './components/About';
import { Logo, Skyline } from './components/Logo';
import { Commute } from './components/Commute';
import type { Km } from './lib/geo';
import { Days } from './components/Days';
import { Hourly } from './components/Hourly';
import { Now } from './components/Now';
import { Radar } from './components/Radar';
import { usePressure } from './lib/usePressure';
import { useRadar } from './lib/useRadar';
import { useWeather } from './lib/useWeather';

export default function App() {
  const w = useWeather();
  const radar = useRadar();
  const pressure = usePressure();
  const [route, setRoute] = useState<Km[] | null>(null);
  const errors = [
    w.ecmwf.error && 'Vorhersage',
    w.hires.error && 'Modellvergleich',
    w.current.error && !w.ecmwf.data && 'aktuelle Werte',
  ].filter(Boolean);

  return (
    <>
    <header className="masthead">
      <Skyline />
      <div className="masthead-in">
        <Logo size={52} />
        <div>
          <p className="masthead-name">
            Wetter<b>2000</b>
          </p>
          <p className="masthead-claim">Föhnomenal genau.</p>
        </div>
      </div>
    </header>
    <div className="app">

      <Commute radar={radar.data} onRoute={setRoute} />

      {w.loading && !w.updatedAt ? (
        <div className="loading" aria-live="polite">
          Lade Wetterdaten …
        </div>
      ) : (
        <Now current={w.current.data} ecmwf={w.ecmwf.data} />
      )}

      <Hourly
        hires={w.hires.data}
        ecmwf={w.ecmwf.data}
        radar={radar.data}
        currentTemp={w.current.data?.weather.temperature ?? w.ecmwf.data?.current?.temperature_2m ?? null}
      />

      <Radar data={radar.data} error={radar.error} route={route} />

      {errors.length > 0 && (
        <p className="error" role="alert">
          {errors.join(', ')} gerade nicht erreichbar. Es wird automatisch erneut versucht.
        </p>
      )}

      <Days ecmwf={w.ecmwf.data} hires={w.hires.data} eps={w.eps.data} pressure={pressure} foehn={w.foehn.data} />

      <About
        updatedAt={w.updatedAt}
        loading={w.loading}
        onReload={() => {
          w.reload();
          radar.reload();
        }}
      />
    </div>
    </>
  );
}
