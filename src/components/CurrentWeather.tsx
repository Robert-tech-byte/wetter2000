import type { CurrentObservation, EcmwfForecast } from '../lib/api';
import { fmt0, fmt1, mm, temp } from '../lib/format';
import { clock, hhmm } from '../lib/time';
import { describeBrightSkyIcon, describeWeather } from '../lib/weatherCodes';

interface Props {
  current: CurrentObservation | null;
  ecmwf: EcmwfForecast | null;
}

export function CurrentWeather({ current, ecmwf }: Props) {
  const obs = current?.weather;
  const station = current?.sources?.[0];
  const model = ecmwf?.current;
  const d = ecmwf?.daily;

  const t = obs?.temperature ?? model?.temperature_2m ?? null;
  const cond = obs?.icon ? describeBrightSkyIcon(obs.icon) : describeWeather(model?.weather_code);

  return (
    <div className="current card">
      <div className="current-main">
        <span className="current-icon" aria-hidden>
          {cond.icon}
        </span>
        <div>
          <div className="current-temp">{t == null ? '–' : `${fmt1(t)}°`}</div>
          <div className="current-cond">{cond.text}</div>
          {d && (
            <div className="muted">
              Heute {temp(d.temperature_2m_min[0])} / {temp(d.temperature_2m_max[0])}
            </div>
          )}
        </div>
      </div>
      <dl className="current-grid">
        {model && (
          <div>
            <dt>Gefühlt</dt>
            <dd>{temp(model.apparent_temperature)}</dd>
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
          <dt>Regen (1 h)</dt>
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
              ↑ {hhmm(d.sunrise[0])} · ↓ {hhmm(d.sunset[0])}
            </dd>
          </div>
        )}
      </dl>
      <p className="muted small">
        {obs
          ? `Messung DWD-Station ${station?.station_name ?? ''}${
              station ? ` (${fmt1(station.distance / 1000)} km entfernt)` : ''
            }, ${clock(obs.timestamp)} Uhr`
          : model
            ? `Modellwert ECMWF IFS, ${hhmm(model.time)} Uhr (keine Stationsmessung verfügbar)`
            : ''}
      </p>
    </div>
  );
}
