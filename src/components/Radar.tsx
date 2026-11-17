import L from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRadar } from '../lib/api';
import { LOCATION } from '../lib/config';
import { fmt1 } from '../lib/format';
import { gridToLatLon, intensityText, parseRadar, pointRate, RAIN_SCALE, rateColor, type RadarData } from '../lib/radar';
import { clock } from '../lib/time';
import { ErrorNote } from './Section';

/** Canvas layer that draws the RADOLAN grid as projected quads. */
class RadarLayer extends L.Layer {
  private canvas = L.DomUtil.create('canvas', 'radar-canvas leaflet-zoom-hide');
  private corners: L.LatLng[][] = [];
  private rate: number[][] = [];

  setGrid(data: RadarData) {
    const { rows, cols, corners } = data;
    this.corners = [];
    for (let r = 0; r <= rows; r++) {
      const line: L.LatLng[] = [];
      for (let c = 0; c <= cols; c++) {
        const [lat, lon] = gridToLatLon(corners, c / cols, r / rows);
        line.push(L.latLng(lat, lon));
      }
      this.corners.push(line);
    }
  }

  setFrame(rate: number[][]) {
    this.rate = rate;
    this.redraw();
  }

  onAdd(map: L.Map) {
    map.getPanes().overlayPane.appendChild(this.canvas);
    map.on('moveend zoomend resize', this.redraw, this);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map) {
    this.canvas.remove();
    map.off('moveend zoomend resize', this.redraw, this);
    return this;
  }

  redraw() {
    const map = (this as unknown as { _map?: L.Map })._map;
    if (!map || !this.corners.length) return;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size.x * dpr;
    this.canvas.height = size.y * dpr;
    this.canvas.style.width = `${size.x}px`;
    this.canvas.style.height = `${size.y}px`;
    L.DomUtil.setPosition(this.canvas, map.containerPointToLayerPoint([0, 0]));
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    const pts = this.corners.map((line) => line.map((ll) => map.latLngToContainerPoint(ll)));
    for (let r = 0; r < this.rate.length; r++) {
      const row = this.rate[r];
      for (let c = 0; c < row.length; c++) {
        const color = rateColor(row[c]);
        if (!color) continue;
        const a = pts[r][c];
        const b = pts[r][c + 1];
        const d = pts[r + 1][c + 1];
        const e = pts[r + 1][c];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(d.x, d.y);
        ctx.lineTo(e.x, e.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

const REFRESH_MS = 5 * 60 * 1000;

export function Radar() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<RadarLayer | null>(null);
  const [data, setData] = useState<RadarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const load = useCallback(async () => {
    try {
      const parsed = parseRadar(await fetchRadar());
      setData(parsed);
      setError(null);
      // Start at the latest observation.
      const latest = parsed.frames.findIndex((f) => f.timestamp === parsed.latestObservation);
      setIndex(latest >= 0 ? latest : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // Map setup
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { center: [LOCATION.lat, LOCATION.lon], zoom: 9, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 13,
      minZoom: 7,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.circleMarker([LOCATION.lat, LOCATION.lon], {
      radius: 6,
      color: '#fff',
      weight: 2,
      fillColor: '#e0245e',
      fillOpacity: 1,
    })
      .bindTooltip('München (Marienplatz)')
      .addTo(map);
    const layer = new RadarLayer();
    layer.addTo(map);
    mapRef.current = map;
    layerRef.current = layer;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (data && layerRef.current) layerRef.current.setGrid(data);
  }, [data]);

  useEffect(() => {
    const frame = data?.frames[index];
    if (frame && layerRef.current) layerRef.current.setFrame(frame.rate);
  }, [data, index]);

  // Animation
  useEffect(() => {
    if (!playing || !data) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % data.frames.length), 600);
    return () => clearInterval(id);
  }, [playing, data]);

  const nowcast = useMemo(() => {
    if (!data) return [];
    return data.frames
      .filter((f) => f.timestamp >= data.latestObservation)
      .map((f) => ({ ...f, point: pointRate(f, data.position) }));
  }, [data]);

  const summary = useMemo(() => {
    if (!nowcast.length) return null;
    const now = nowcast[0].point;
    const firstRain = nowcast.find((f) => f.point >= 0.1);
    const lastRain = [...nowcast].reverse().find((f) => f.point >= 0.1);
    const peak = Math.max(...nowcast.map((f) => f.point));
    if (!firstRain) return 'In den nächsten 60 Minuten kein Regen in München erwartet.';
    if (now >= 0.1) {
      const stops = nowcast.find((f) => f.point < 0.1 && f.timestamp > firstRain.timestamp);
      return stops
        ? `Es regnet (${intensityText(now)}). Voraussichtlich trocken ab ca. ${clock(stops.timestamp)} Uhr.`
        : `Es regnet (${intensityText(now)}) und hört in der nächsten Stunde voraussichtlich nicht auf.`;
    }
    return `Regen ab ca. ${clock(firstRain.timestamp)} Uhr (${intensityText(peak)}, bis ${fmt1(peak)} mm/h)${
      lastRain && lastRain !== firstRain ? `, bis etwa ${clock(lastRain.timestamp)} Uhr` : ''
    }.`;
  }, [nowcast]);

  const frame = data?.frames[index];
  const peak = Math.max(0.5, ...nowcast.map((f) => f.point));

  return (
    <div className="radar">
      <ErrorNote what="Das Regenradar" error={error} />
      {summary && <p className="radar-summary card">☔ {summary}</p>}

      <div className="card radar-card">
        <div ref={mapEl} className="radar-map" role="region" aria-label="Regenradar-Karte" />
        {frame && (
          <div className="radar-controls">
            <button
              className="play"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Animation anhalten' : 'Animation abspielen'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={(data?.frames.length ?? 1) - 1}
              value={index}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
              aria-label="Zeitpunkt"
            />
            <span className={`frame-label ${frame.isForecast ? 'forecast' : ''}`}>
              {clock(frame.timestamp)} Uhr
              <small>{frame.isForecast ? `Vorhersage +${frame.leadMinutes} min` : 'gemessen'}</small>
            </span>
          </div>
        )}
        <div className="legend" aria-label="Legende Niederschlag in mm/h">
          {RAIN_SCALE.map((s) => (
            <span key={s.min}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <span className="muted">mm/h</span>
        </div>
      </div>

      {nowcast.length > 0 && (
        <div className="card nowcast">
          <h3 className="chart-title">München, nächste 60 Minuten</h3>
          <div className="nowcast-bars" role="img" aria-label="Regenintensität in den nächsten 60 Minuten">
            {nowcast.map((f) => (
              <div key={f.timestamp} className="nowcast-col" title={`${clock(f.timestamp)}: ${fmt1(f.point)} mm/h`}>
                <div
                  className="nowcast-bar"
                  style={{
                    height: `${Math.min(100, (f.point / peak) * 100)}%`,
                    background: rateColor(f.point) ?? 'transparent',
                  }}
                />
                <span>{f.leadMinutes % 15 === 0 ? `+${f.leadMinutes}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data && (
        <p className="muted small">
          DWD-Radarkomposit RV (1 km, 5 min) über Bright Sky. Letzte Messung {clock(data.latestObservation)} Uhr, danach
          DWD-Nowcast. Aktualisiert alle 5 Minuten.
        </p>
      )}
    </div>
  );
}
