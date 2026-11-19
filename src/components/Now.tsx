import { useState } from 'react';
import type { FoehnSeries } from '../lib/api';
import type { PressureData } from '../lib/pressure';
import { GrowelaPanel } from './Growela';
import type { CurrentObservation, EcmwfForecast } from '../lib/api';
import { fmt0, fmt1, mm } from '../lib/format';
import { clock, hhmm } from '../lib/time';
import { describeBrightSkyIcon, describeWeather } from '../lib/weatherCodes';
import { WeatherIcon } from './Icon';
import { useTendency } from '../lib/useTendency';
import type { Tendency } from '../lib/tendency';

const TENDENCY_WORD = { up: 'steigend', down: 'fallend', flat: 'gleichbleibend' } as const;
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt1(Math.abs(v)).replace('-', '');

/** Small arrow for the temperature tendency of the last hour; tap shows the exact change. */
function TendencyArrow({ t }: { t: Tendency }) {
  const [open, setOpen] = useState(false);
  const rot = t.dir === 'up' ? -90 : t.dir === 'down' ? 90 : 0;
  const detail = `${signed(t.delta)} °C seit ${hhmm(t.from)}`;
  return (
    <button
      type="button"
      className="tendency"
      aria-expanded={open}
      aria-label={`Tendenz letzte Stunde: ${TENDENCY_WORD[t.dir]}, ${detail}`}
      title={`Letzte Stunde: ${detail}`}
      onClick={() => setOpen((o) => !o)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
        <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {open && <span className="tendency-detail">{detail}</span>}
    </button>
  );
}

interface Props {
  current: CurrentObservation | null;
  ecmwf: EcmwfForecast | null;
  pressure: PressureData | null;
  foehn: { munich: FoehnSeries; bozen: FoehnSeries } | null;
}

export function Now({ current, ecmwf, pressure, foehn }: Props) {
  const obs = current?.weather;
  const station = current?.sources?.[0];
  const model = ecmwf?.current;
  const d = ecmwf?.daily;

  const t = obs?.temperature ?? model?.temperature_2m ?? null;
  const cond = describeBrightSkyIcon(obs?.icon) ?? describeWeather(model?.weather_code);
  const [more, setMore] = useState(false);
  const tendency = useTendency(current);
  const [gw, setGw] = useState(false);
  const hi = d?.temperature_2m_max[0];
  const lo = d?.temperature_2m_min[0];

  return (
    <section className="now" aria-label="Wetter jetzt">
      <div className="now-main">
        <div className="now-temp-row">
          <div className="now-temp">{t == null ? '–' : `${fmt1(t)}°`}</div>
          {obs?.temperature != null && tendency && <TendencyArrow t={tendency} />}
        </div>
        <WeatherIcon name={cond.icon} className="now-icon" />
      </div>
      <p className="now-cond">{cond.text}</p>
      <div className="now-gw">
        <button
          type="button"
          className="gw-button"
          aria-expanded={gw}
          aria-controls="growela"
          title="Großwetterlage"
          onClick={() => setGw((v) => !v)}
        >
          GroWeLa
        </button>
      </div>
      {gw && <GrowelaPanel pressure={pressure} foehn={foehn} />}
      <div className="now-hl">
        <span>{hi != null && lo != null ? `H ${fmt0(hi)}° · T ${fmt0(lo)}°` : ''}</span>
        <button type="button" className="toggle" aria-expanded={more} aria-controls="now-more" onClick={() => setMore((m) => !m)}>
          Mehr zu jetzt
        </button>
      </div>
      <div id="now-more" className="now-more" hidden={!more}>
        <dl className="kv">
          {model && (
            <div>
              <dt>Gefühlt</dt>
              <dd>{fmt1(model.apparent_temperature)}°</dd>
            </div>
          )}
          <div>
            <dt>Luftfeuchte</dt>
            <dd>{fmt0(obs?.relative_humidity ?? model?.relative_humidity_2m)} %</dd>
          </div>
          <div>
            <dt>Wind</dt>
            <dd>{fmt0(obs?.wind_speed_10 ?? model?.wind_speed_10m)} km/h</dd>
          </div>
          {obs?.wind_gust_speed_10 != null && (
            <div>
              <dt>Böen</dt>
              <dd>{fmt0(obs.wind_gust_speed_10)} km/h</dd>
            </div>
          )}
          <div>
            <dt>Regen letzte Stunde</dt>
            <dd>{mm(obs?.precipitation_60 ?? model?.precipitation)}</dd>
          </div>
          {obs?.pressure_msl != null && (
            <div>
              <dt>Luftdruck</dt>
              <dd>{fmt0(obs.pressure_msl)} hPa</dd>
            </div>
          )}
          {d && (
            <div>
              <dt>Sonne</dt>
              <dd>
                {hhmm(d.sunrise[0])} – {hhmm(d.sunset[0])}
              </dd>
            </div>
          )}
        </dl>
        <p className="note">
          {obs
            ? `Gemessen an der DWD-Station ${station?.station_name ?? ''}${
                station ? ` (${fmt1(station.distance / 1000)} km vom Zentrum)` : ''
              }, ${clock(obs.timestamp)} Uhr.`
            : model
              ? `Keine Stationsmessung verfügbar, Modellwert ECMWF IFS (${hhmm(model.time)} Uhr).`
              : ''}
        </p>
      </div>
    </section>
  );
}
