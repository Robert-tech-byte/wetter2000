import type { CurrentObservation, EcmwfForecast } from '../lib/api';
import { fmt0, fmt1, mm } from '../lib/format';
import { clock, hhmm } from '../lib/time';
import { describeBrightSkyIcon, describeWeather } from '../lib/weatherCodes';
import { WeatherIcon } from './Icon';

export function Now({ current, ecmwf }: { current: CurrentObservation | null; ecmwf: EcmwfForecast | null }) {
  const obs = current?.weather;
  const station = current?.sources?.[0];
  const model = ecmwf?.current;
  const d = ecmwf?.daily;

  const t = obs?.temperature ?? model?.temperature_2m ?? null;
  const cond = describeBrightSkyIcon(obs?.icon) ?? describeWeather(model?.weather_code);
  const hi = d?.temperature_2m_max[0];
  const lo = d?.temperature_2m_min[0];

  return (
    <section className="now" aria-label="Wetter jetzt">
      <div className="now-main">
        <div className="now-temp">{t == null ? '–' : `${fmt1(t)}°`}</div>
        <WeatherIcon name={cond.icon} className="now-icon" />
      </div>
      <p className="now-cond">{cond.text}</p>
      {hi != null && lo != null && (
        <p className="now-hl">
          H {fmt0(hi)}° · T {fmt0(lo)}°
        </p>
      )}
      <details className="fold">
        <summary>Mehr zu jetzt</summary>
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
      </details>
    </section>
  );
}
