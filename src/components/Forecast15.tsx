import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { EcmwfForecast } from '../lib/api';
import { fmt0, fmt1, mm } from '../lib/format';
import { formatDayShort, relativeDayName } from '../lib/time';
import { useThemeColors } from '../lib/useThemeColors';
import { describeWeather } from '../lib/weatherCodes';

export function Forecast15({ data }: { data: EcmwfForecast }) {
  const c = useThemeColors();
  const d = data.daily;
  const rows = d.time
    .map((time, i) => ({
      time,
      label: formatDayShort(time),
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      rain: d.precipitation_sum[i],
      code: d.weather_code[i],
      gust: d.wind_gusts_10m_max[i],
    }))
    .filter((r) => r.max != null && r.min != null);

  const lo = Math.min(...rows.map((r) => r.min as number));
  const hi = Math.max(...rows.map((r) => r.max as number));
  const span = Math.max(hi - lo, 1);
  const today = rows[0]?.time ?? '';

  return (
    <>
      <div className="card chart-card">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={c['--grid']} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: c['--muted'], fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="t" unit="°" tick={{ fill: c['--muted'], fontSize: 11 }} width={44} />
            <YAxis
              yAxisId="r"
              orientation="right"
              unit=" mm"
              tick={{ fill: c['--muted'], fontSize: 11 }}
              width={48}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ background: c['--surface'], border: `1px solid ${c['--grid']}`, color: c['--text'] }}
              formatter={(v: number, name: string) => [name === 'Regen' ? mm(v) : `${fmt1(v)} °C`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: c['--muted'] }} />
            <Bar isAnimationActive={false} yAxisId="r" dataKey="rain" name="Regen" fill={c['--rain']} opacity={0.55} radius={[3, 3, 0, 0]} />
            <Line isAnimationActive={false} yAxisId="t" dataKey="max" name="Max" stroke={c['--temp-max']} strokeWidth={2} dot={false} />
            <Line isAnimationActive={false} yAxisId="t" dataKey="min" name="Min" stroke={c['--temp-min']} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ol className="days card">
        {rows.map((r) => {
          const w = describeWeather(r.code);
          const left = (((r.min as number) - lo) / span) * 100;
          const width = Math.max((((r.max as number) - (r.min as number)) / span) * 100, 2);
          return (
            <li key={r.time} className="day-row">
              <span className="day-name">
                <strong>{relativeDayName(r.time, today)}</strong>
                <span className="muted small">{formatDayShort(r.time).split(' ')[1]}</span>
              </span>
              <span className="day-icon" title={w.text} aria-label={w.text}>
                {w.icon}
              </span>
              <span className="day-temp min">{fmt0(r.min)}°</span>
              <span className="range-track" aria-hidden>
                <span className="range-bar" style={{ left: `${left}%`, width: `${width}%` }} />
              </span>
              <span className="day-temp max">{fmt0(r.max)}°</span>
              <span className={`day-rain ${(r.rain ?? 0) >= 0.1 ? '' : 'muted'}`}>💧 {mm(r.rain)}</span>
              <span className="day-wind muted">💨 {fmt0(r.gust)}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
