import type { ReactNode } from 'react';
import { fmt0 } from '../lib/format';
import type { Condition } from '../lib/weatherCodes';
import { WeatherIcon } from './Icon';

export interface Scale {
  lo: number;
  hi: number;
}

export function TempRange({ lo, hi, scale }: { lo: number; hi: number; scale: Scale }) {
  const span = Math.max(1, scale.hi - scale.lo);
  const left = ((lo - scale.lo) / span) * 100;
  const width = Math.max(3, ((hi - lo) / span) * 100);
  return (
    <span className="range">
      <span className="lo">{fmt0(lo)}°</span>
      <span className="track" aria-hidden="true">
        <b style={{ left: `${left}%`, width: `${width}%` }} />
      </span>
      <span className="hi">{fmt0(hi)}°</span>
    </span>
  );
}

interface Props {
  name: string;
  date: string;
  cond: Condition;
  lo: number;
  hi: number;
  scale: Scale;
  rain: ReactNode;
  badge?: ReactNode;
  trailing: ReactNode;
  children: ReactNode;
  open?: boolean;
}

export function DayRow({ name, date, cond, lo, hi, scale, rain, badge, trailing, children, open }: Props) {
  return (
    <details className="row" open={open}>
      <summary>
        <span className="row-name">
          {name}
          {date && <small>{date}</small>}
          {badge}
        </span>
        <WeatherIcon name={cond.icon} title={cond.text} />
        <TempRange lo={lo} hi={hi} scale={scale} />
        <span className="row-rain">{rain}</span>
        <span className="row-end">{trailing}</span>
      </summary>
      <div className="row-detail">{children}</div>
    </details>
  );
}
