import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt1 } from '../lib/format';
import { nowcastSentence } from '../lib/nowcast';
import { MAP_MIN_RATE, pointRateAt, rainCss, RAIN_STOPS, type RadarData } from '../lib/radar';
import { clock } from '../lib/time';
import { RadarCanvas } from './RadarCanvas';
import { RadarZoom } from './RadarZoom';
import type { Km } from '../lib/geo';

const RAIN = 0.1;
/** Playback speed in frames (5 min) per second. */
const SPEED = 2.5;

function useReducedMotion() {
  const [reduce, setReduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

export function Radar({ data, error, route }: { data: RadarData | null; error: string | null; route?: Km[] | null }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [large, setLarge] = useState(false);
  const reduce = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const userMoved = useRef(false);

  // Start at the latest observation whenever new data arrives (unless the user is scrubbing).
  useEffect(() => {
    if (data && !userMoved.current) setT(data.latestIndex);
  }, [data]);

  // Smooth playback with cross-fading between frames.
  useEffect(() => {
    if (!playing || !data) return;
    let raf = 0;
    let last = performance.now();
    const max = data.frames.length - 1;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((v) => (v + dt * (reduce ? 1 : SPEED) > max ? 0 : v + dt * (reduce ? 1 : SPEED)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, data, reduce]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (large && !d.open) d.showModal();
    if (!large && d.open) d.close();
  }, [large]);

  const strip = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 13 }, (_, i) => data.latestIndex + i)
      .filter((k) => k < data.frames.length)
      .map((k) => pointRateAt(data, k));
  }, [data]);
  const stripMax = Math.max(1, ...strip);

  const frameInfo = useMemo(() => {
    if (!data?.frames.length) return null;
    const k = Math.round(t);
    const f = data.frames[Math.max(0, Math.min(data.frames.length - 1, k))];
    const offset = Math.round((t - data.latestIndex) * 5);
    const ts = new Date(new Date(data.latestObservation).getTime() + offset * 60000);
    return {
      time: clock(ts),
      tag: offset === 0 ? 'jetzt' : offset > 0 ? `+${offset} min` : `${offset} min`,
      forecast: f.isForecast || offset > 0,
    };
  }, [data, t]);

  if (error && !data) return <p className="error">Das Regenradar ist gerade nicht erreichbar ({error}).</p>;

  const controls = data && frameInfo && (
    <div className="radar-controls">
      <button
        type="button"
        className="round"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Animation anhalten' : 'Animation abspielen'}
      >
        {playing ? (
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <rect x="2.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
            <rect x="8.5" y="1.5" width="3" height="11" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 1.5v11l9-5.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={data.frames.length - 1}
        step={0.05}
        value={t}
        onChange={(e) => {
          userMoved.current = true;
          setPlaying(false);
          setT(Number(e.target.value));
        }}
        aria-label="Zeitpunkt des Radarbilds"
        aria-valuetext={`${frameInfo.time} Uhr, ${frameInfo.tag}`}
      />
      <output className={frameInfo.forecast ? 'forecast' : ''}>
        {frameInfo.time} <span>{frameInfo.tag}</span>
      </output>
    </div>
  );

  return (
    <div className="radar">
      {data && (
        <div className="rainline">
          <p className="rain-sentence">{nowcastSentence(data)}</p>
          <div className="strip" aria-hidden="true">
            {strip.map((v, i) => (
              <i
                key={i}
                style={{
                  height: `${Math.max(6, (v / stripMax) * 100)}%`,
                  background: v >= RAIN ? rainCss(v, 0.75) : undefined,
                }}
                title={`${fmt1(v)} mm/h`}
              />
            ))}
          </div>
          <div className="strip-axis" aria-hidden="true">
            <span>jetzt</span>
            <span>+30</span>
            <span>+60 min</span>
          </div>
        </div>
      )}

      {/* Overview: ±15 km wide, ±12 km high (just beyond the 10 km ring) to save height. */}
      <button type="button" className="radar-frame wide" onClick={() => setLarge(true)} aria-label="Radar groß anzeigen">
        <RadarCanvas data={data} t={t} extent={15} extentY={12} route={route} label="Regenradar München" />
        {!data && <span className="radar-loading">Radar wird geladen …</span>}
      </button>
      {controls}

      <dialog ref={dialog} className="radar-dialog" onClose={() => setLarge(false)} aria-label="Regenradar groß">
        <div className="dialog-head">
          <strong>Regenradar</strong>
          <button type="button" className="round" onClick={() => setLarge(false)} aria-label="Schließen">
            <svg viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {large && (
          <RadarZoom data={data} t={t} route={route} />
        )}
        {controls}
        <Legend />
      </dialog>
    </div>
  );
}

export function Legend() {
  const stops = [MAP_MIN_RATE, ...RAIN_STOPS.map(([v]) => v).filter((v) => v > MAP_MIN_RATE)];
  const gradient = `linear-gradient(90deg, ${stops.map((v) => rainCss(v, 0.55)).join(', ')})`;
  const min = String(MAP_MIN_RATE).replace('.', ',');
  return (
    <div className="legend" aria-label={`Farbskala Niederschlag ${min} bis 50 Millimeter pro Stunde`}>
      <span>{min}</span>
      <i style={{ background: gradient }} />
      <span>50 mm/h</span>
    </div>
  );
}
