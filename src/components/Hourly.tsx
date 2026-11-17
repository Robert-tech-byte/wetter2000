import { useMemo } from 'react';
import type { EcmwfForecast, MemberSet } from '../lib/api';
import { fmt0, fmt1 } from '../lib/format';
import { nextHours } from '../lib/hourly';
import type { RadarData } from '../lib/radar';
import { localHourKey } from '../lib/time';
import { WeatherIcon } from './Icon';

interface Props {
  hires: MemberSet | null;
  ecmwf: EcmwfForecast | null;
  radar: RadarData | null;
  currentTemp: number | null;
}

/** Horizontally scrollable 12-hour forecast (model median, first hour from the radar nowcast). */
export function Hourly({ hires, ecmwf, radar, currentTemp }: Props) {
  const nowKey = localHourKey();
  const cards = useMemo(
    () => (hires ? nextHours(hires, nowKey, ecmwf, radar, currentTemp) : []),
    [hires, nowKey, ecmwf, radar, currentTemp],
  );
  if (!cards.length) return null;

  return (
    <section className="hourly" aria-label="Die nächsten 12 Stunden">
      <ol className="hours" tabIndex={0}>
        {cards.map((c) => {
          const wet = (c.rainProbability ?? 0) >= 0.5 || (c.rainMm ?? 0) >= 0.1;
          return (
            <li key={c.time} className={`${c.source === 'radar' ? 'now' : ''} ${wet ? 'wet' : ''}`}>
              <span className="h-time">{c.label}</span>
              <WeatherIcon name={c.icon} />
              <span className="h-temp">{c.temp == null ? '–' : `${fmt0(c.temp)}°`}</span>
              <span className="h-rain">
                {c.rainProbability != null ? `${fmt0(c.rainProbability * 100)} %` : (c.rainMm ?? 0) >= 0.05 ? 'Radar' : ''}
              </span>
              <span className="h-mm">{(c.rainMm ?? 0) >= 0.05 ? `${fmt1(c.rainMm)} mm` : ''}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
