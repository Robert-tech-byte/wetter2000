/** Minimal line icons for weather conditions. */
export type IconName = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'sleet' | 'thunder' | 'wind';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const CLOUD_LOW = 'M7 14h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 7.2 3.5 3.5 0 0 0 7 14z';
const CLOUD = 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 11.2 3.5 3.5 0 0 0 7 18z';

export function WeatherIcon({ name, title, className = 'wx' }: { name: IconName; title?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {name === 'sun' && (
        <>
          <circle cx="12" cy="12" r="4" {...stroke} />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" {...stroke} />
        </>
      )}
      {name === 'moon' && <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" {...stroke} />}
      {name === 'partly' && (
        <>
          <path d="M9 4.5v1.6M4.2 9H5.8M5.6 5.6l1.1 1.1M12.4 5.6l-1.1 1.1M6.4 11.2A3.2 3.2 0 0 1 12 8.6" {...stroke} />
          <path d="M9 19h8.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.5.9A3 3 0 0 0 9 19z" {...stroke} />
        </>
      )}
      {name === 'cloud' && <path d={CLOUD} {...stroke} />}
      {name === 'fog' && <path d="M4 9h16M6 13h12M4 17h16" {...stroke} />}
      {name === 'wind' && <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3" {...stroke} />}
      {(name === 'drizzle' || name === 'rain' || name === 'snow' || name === 'sleet' || name === 'thunder') && (
        <path d={CLOUD_LOW} {...stroke} />
      )}
      {name === 'drizzle' && <path d="M9 17.5v1M13 18.5v1M17 17.5v1" {...stroke} />}
      {name === 'rain' && <path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3" {...stroke} />}
      {name === 'snow' && (
        <g fill="currentColor">
          <circle cx="9" cy="18.5" r="1" />
          <circle cx="13" cy="20" r="1" />
          <circle cx="16.5" cy="18" r="1" />
        </g>
      )}
      {name === 'sleet' && (
        <>
          <path d="M9 17l-1 3M16 17l-1 3" {...stroke} />
          <circle cx="12.5" cy="19" r="1" fill="currentColor" />
        </>
      )}
      {name === 'thunder' && <path d="M12.5 15l-2 3.5h3l-2 3.5" {...stroke} />}
    </svg>
  );
}
