/** Flat, coloured weather icons (style A): yellow sun, grey clouds, blue rain. */
export type IconName = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'sleet' | 'thunder' | 'wind';

const SUN = '#F7B733';
const RAY = '#F5A524';
const CLOUD = '#B4C0CD';
const CLOUD_DARK = '#9FACBA';
const CLOUD_LIGHT = '#C3CDD8';
const RAIN = '#3A86F0';
const SNOW = '#8FC1F5';

const CLOUD_LOW = 'M17 46h28a10 10 0 0 0 1.5-19.9A15 15 0 0 0 17.6 23.4 11.5 11.5 0 0 0 17 46z';
const CLOUD_HIGH = 'M17 38h28a10 10 0 0 0 1.5-19.9A15 15 0 0 0 17.6 15.4 11.5 11.5 0 0 0 17 38z';

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * (r + 4)}
            y1={cy + Math.sin(a) * (r + 4)}
            x2={cx + Math.cos(a) * (r + 9)}
            y2={cy + Math.sin(a) * (r + 9)}
            stroke={RAY}
            strokeWidth={3.2}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r} fill={SUN} />
    </g>
  );
}

function Drops({ n, len }: { n: number; len: number }) {
  return (
    <>
      {[20, 30, 40, 50].slice(0, n).map((x, i) => (
        <line key={x} x1={x} y1={48 + (i % 2) * 3} x2={x - 3} y2={48 + (i % 2) * 3 + len} stroke={RAIN} strokeWidth={3.2} strokeLinecap="round" />
      ))}
    </>
  );
}

function Flakes({ at }: { at: [number, number][] }) {
  return (
    <>
      {at.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={3} fill={SNOW} />
      ))}
    </>
  );
}

export function WeatherIcon({ name, title, className = 'wx' }: { name: IconName; title?: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {name === 'sun' && <Sun cx={32} cy={32} r={12} />}
      {name === 'moon' && (
        <path d="M30 14a18 18 0 1 0 20.5 24.4A15 15 0 0 1 30 14z" fill="#F2C94C" />
      )}
      {name === 'partly' && (
        <>
          <Sun cx={24} cy={24} r={9} />
          <path d="M24 50h22a8 8 0 0 0 1.2-15.9A12 12 0 0 0 24.5 31.5 9 9 0 0 0 24 50z" fill={CLOUD} />
        </>
      )}
      {name === 'cloud' && (
        <>
          <path d={CLOUD_LOW} fill={CLOUD_DARK} />
          <path d="M23 44h22a8 8 0 0 0 1-15.9A11.5 11.5 0 0 0 23.3 25 8.7 8.7 0 0 0 23 44z" fill={CLOUD_LIGHT} />
        </>
      )}
      {name === 'fog' &&
        [22, 30, 38, 46].map((y, i) => (
          <line key={y} x1={12 + (i % 2) * 6} y1={y} x2={52 - ((i + 1) % 2) * 6} y2={y} stroke="#A9B5C2" strokeWidth={3.6} strokeLinecap="round" />
        ))}
      {name === 'drizzle' && (
        <>
          <path d={CLOUD_HIGH} fill={CLOUD} />
          <Drops n={3} len={4} />
        </>
      )}
      {name === 'rain' && (
        <>
          <path d={CLOUD_HIGH} fill={CLOUD_DARK} />
          <Drops n={4} len={9} />
        </>
      )}
      {name === 'sleet' && (
        <>
          <path d={CLOUD_HIGH} fill={CLOUD} />
          <line x1={22} y1={46} x2={19} y2={55} stroke={RAIN} strokeWidth={3.2} strokeLinecap="round" />
          <line x1={42} y1={46} x2={39} y2={55} stroke={RAIN} strokeWidth={3.2} strokeLinecap="round" />
          <Flakes at={[[31, 51]]} />
        </>
      )}
      {name === 'snow' && (
        <>
          <path d={CLOUD_HIGH} fill={CLOUD} />
          <Flakes at={[[22, 47], [32, 53], [42, 47], [27, 58], [38, 59]]} />
        </>
      )}
      {name === 'thunder' && (
        <>
          <path d={CLOUD_HIGH} fill="#8D9AA8" />
          <path d="M33 38l-7 12h6l-3 10 10-14h-6l4-8z" fill={SUN} />
        </>
      )}
      {name === 'wind' && (
        <path d="M8 26h28a6 6 0 1 0-6-6M8 36h38a6 6 0 1 1-6 6M8 31h18" fill="none" stroke={CLOUD_DARK} strokeWidth={3.6} strokeLinecap="round" />
      )}
    </svg>
  );
}
