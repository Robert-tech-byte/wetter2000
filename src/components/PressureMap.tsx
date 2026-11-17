import { useMemo } from 'react';
import europe from '../data/europe.json';
import { LOCATION } from '../lib/config';
import { extrema, isoline, upsample, type PressureData, type Pt } from '../lib/pressure';

const [W, S, E, N] = [-25, 35, 45, 72.5];
const KX = Math.cos((53 * Math.PI) / 180);
const WIDTH = 600;
const SCALE = WIDTH / ((E - W) * KX);
const HEIGHT = Math.round((N - S) * SCALE);
const px = ([lon, lat]: Pt) => [((lon - W) * KX * SCALE).toFixed(1), ((N - lat) * SCALE).toFixed(1)];

const LAND = (europe as unknown as { rings: Pt[][] }).rings
  .map((r) => `M${r.map((p) => px(p).join(',')).join('L')}Z`)
  .join('');

function stand(generated: string): string {
  const d = new Date(generated.replace(/Z$/, ':00Z'));
  if (Number.isNaN(d.getTime())) return '';
  const f = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  return `, Stand ${f.format(d)} Uhr`;
}

/** Europe sea-level pressure at 12:00: isobars every 5 hPa, highs (H) and lows (T). */
export function PressureMap({ data, date }: { data: PressureData; date: string }) {
  const day = data.days.find((d) => d.date === date);

  const drawn = useMemo(() => {
    if (!day) return null;
    const up = upsample(day.p, data.lats, data.lons, 4);
    const values = up.grid.flat();
    const lo = Math.ceil(Math.min(...values) / 5) * 5;
    const hi = Math.floor(Math.max(...values) / 5) * 5;
    const lines: { level: number; d: string }[] = [];
    for (let level = lo; level <= hi; level += 5) {
      const segs = isoline(up.grid, up.lat, up.lon, level);
      lines.push({ level, d: segs.map(([a, b]) => `M${px(a).join(',')}L${px(b).join(',')}`).join('') });
    }
    return { lines, marks: extrema(day.p, data.lats, data.lons) };
  }, [day, data]);

  if (!day || !drawn) return <p className="note">Für diesen Tag liegt keine Luftdruckkarte vor.</p>;
  const [mx, my] = px([LOCATION.lon, LOCATION.lat]);

  return (
    <figure className="pressure">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Luftdruck Europa ${date} 12 Uhr`}>
        <rect width={WIDTH} height={HEIGHT} className="sea" />
        <path d={LAND} className="land" />
        {drawn.lines.map((l) => (
          <path key={l.level} d={l.d} className={l.level % 20 === 0 ? 'iso major' : 'iso'} />
        ))}
        <circle cx={mx} cy={my} r={4} className="munich" />
        {drawn.marks.map((m) => {
          const [x, y] = px([m.lon, m.lat]).map(Number);
          return (
            <g key={`${m.kind}${m.lon},${m.lat}`} className={m.kind === 'H' ? 'high' : 'low'}>
              <text x={x} y={y + 9} textAnchor="middle" className="hl">
                {m.kind}
              </text>
              <text x={x} y={y + 24} textAnchor="middle" className="hv">
                {Math.round(m.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="note">
        Luftdruck auf Meereshöhe um 12 Uhr, Linien alle 5 hPa · H = Hoch, T = Tief ·{' '}
        {data.model.startsWith('ecmwf') ? 'ECMWF' : data.model} über Open-Meteo{stand(data.generated)}, Karte: Natural Earth
      </figcaption>
    </figure>
  );
}
