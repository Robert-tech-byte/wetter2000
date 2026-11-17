import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EcmwfForecast, MemberSet } from '../lib/api';
import { fmt0, fmt1 } from '../lib/format';
import { compass, hourDetail, nextHours, type HourCard } from '../lib/hourly';
import type { ConfidenceLevel } from '../lib/agreement';
import { ConfidenceDots } from './Confidence';
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
  const [selected, setSelected] = useState<string | null>(null);
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
              <button
                type="button"
                aria-pressed={selected === c.time}
                aria-controls="hour-detail"
                onClick={() => setSelected((s) => (s === c.time ? null : c.time))}
              >
                <span className="h-time">{c.label}</span>
                <WeatherIcon name={c.icon} />
                <span className="h-temp">{c.temp == null ? '–' : `${fmt0(c.temp)}°`}</span>
                <span className="h-rain">
                  {c.rainProbability != null ? `${fmt0(c.rainProbability * 100)} %` : (c.rainMm ?? 0) >= 0.05 ? 'Radar' : ''}
                </span>
                <span className="h-mm">{(c.rainMm ?? 0) >= 0.05 ? `${fmt1(c.rainMm)} mm` : ''}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {scrollable && (
        <div className="scroll-ind" aria-hidden="true">
          <i style={{ width: `${view.size * 100}%`, left: `${view.pos * (1 - view.size) * 100}%` }} />
        </div>
      )}
      {selected && hires && (
        <HourDetails card={cards.find((c) => c.time === selected)!} hires={hires} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

const level = (v: number | null): ConfidenceLevel | null => (v == null ? null : v >= 0.8 ? 3 : v >= 0.5 ? 2 : 1);
const WORD: Record<ConfidenceLevel, string> = { 3: 'sicher', 2: 'ziemlich sicher', 1: 'unsicher' };

function HourDetails({ card, hires, onClose }: { card: HourCard; hires: MemberSet; onClose: () => void }) {
  const d = hourDetail(hires, card.index);
  const lt = level(d.tempAgreement);
  const lr = level(d.rainConsensus);
  const title = card.source === 'radar' ? `Jetzt (${card.time.slice(11, 13)} Uhr)` : card.label;
  return (
    <div id="hour-detail" className="hour-detail" role="region" aria-label={`Details ${title}`}>
      <div className="hd-head">
        <strong>{title}</strong>
        <span className="note">Median von {d.n} Modellen</span>
        <button type="button" className="round small" onClick={onClose} aria-label="Details schließen">
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <dl className="kv">
        <div>
          <dt>Temperatur</dt>
          <dd>
            {d.temp == null ? '–' : `${fmt1(d.temp)}°`}
            {d.tempRange && <span className="sub">Modelle {fmt1(d.tempRange[0])}° bis {fmt1(d.tempRange[1])}°</span>}
          </dd>
        </div>
        <div>
          <dt>Gefühlt</dt>
          <dd>{d.apparent == null ? '–' : `${fmt1(d.apparent)}°`}</dd>
        </div>
        <div>
          <dt>Regen</dt>
          <dd>
            {d.rainProbability == null ? '–' : `${fmt0(d.rainProbability * 100)} %`}
            {d.rainMm != null && d.rainMm >= 0.05 ? ` · ${fmt1(d.rainMm)} mm` : ''}
            <span className="sub">
              {d.rainMembers} von {d.n} Modellen
              {card.source === 'radar' && card.rainMm != null ? ` · Radar: ${fmt1(card.rainMm)} mm in der nächsten Stunde` : ''}
            </span>
          </dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>
            {d.wind == null ? '–' : `${fmt0(d.wind)} km/h`}
            {d.direction != null ? ` aus ${compass(d.direction)}` : ''}
            {d.gust != null && <span className="sub">Böen bis {fmt0(d.gust)} km/h</span>}
          </dd>
        </div>
        <div>
          <dt>Bewölkung</dt>
          <dd>{d.cloud == null ? '–' : `${fmt0(d.cloud)} %`}</dd>
        </div>
        <div>
          <dt>Luftfeuchte</dt>
          <dd>{d.humidity == null ? '–' : `${fmt0(d.humidity)} %`}</dd>
        </div>
      </dl>
      <dl className="hd-conf">
        <div>
          <dt>Temperatur</dt>
          <dd>
            <ConfidenceDots level={lt} /> {lt ? WORD[lt] : '–'}
          </dd>
        </div>
        <div>
          <dt>Regen</dt>
          <dd>
            <ConfidenceDots level={lr} /> {lr ? WORD[lr] : '–'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
