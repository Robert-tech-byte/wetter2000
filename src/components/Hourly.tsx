import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const list = useRef<HTMLOListElement>(null);
  // Visible share and position of the strip, for the scroll indicator.
  const [view, setView] = useState({ size: 1, pos: 0 });
  const measure = useCallback(() => {
    const el = list.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setView({ size: el.clientWidth / el.scrollWidth, pos: max > 0 ? el.scrollLeft / max : 0 });
  }, []);
  useEffect(() => {
    measure();
    const el = list.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, cards.length]);

  if (!cards.length) return null;
  const scrollable = view.size < 0.999;

  return (
    <section
      className={`hourly ${scrollable && view.pos > 0.01 ? 'more-left' : ''} ${scrollable && view.pos < 0.99 ? 'more-right' : ''}`}
      aria-label="Die nächsten 12 Stunden"
    >
      <ol className="hours" tabIndex={0} ref={list} onScroll={measure}>
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
      {scrollable && (
        <div className="scroll-ind" aria-hidden="true">
          <i style={{ width: `${view.size * 100}%`, left: `${view.pos * (1 - view.size) * 100}%` }} />
        </div>
      )}
    </section>
  );
}
