import { describe, expect, it } from 'vitest';
import { tendencyFrom, type PastWeather } from './tendency';

const past = (rows: [string, number, number][]): PastWeather => ({
  weather: rows.map(([timestamp, temperature, source_id]) => ({ timestamp, temperature, source_id })),
  sources: [
    { id: 1, dwd_station_id: '03379', observation_type: 'current' },
    { id: 2, dwd_station_id: '03379', observation_type: 'forecast' },
    { id: 3, dwd_station_id: '05404', observation_type: 'current' },
  ],
});
const now = { timestamp: '2026-11-19T13:00:00+01:00', temperature: 8.4, stationId: '03379' };

describe('tendency', () => {
  it('flat below 0.5 °C (real values of 19.11.)', () => {
    const t = tendencyFrom(now, past([['2026-11-19T11:00:00+01:00', 8.2, 1], ['2026-11-19T12:00:00+01:00', 8.0, 1]]));
    expect(t).toEqual({ delta: 0.4, dir: 'flat', from: '2026-11-19T12:00:00+01:00' });
  });

  it('up and down from 0.5 °C', () => {
    expect(tendencyFrom(now, past([['2026-11-19T12:00:00+01:00', 7.6, 1]]))?.dir).toBe('up');
    expect(tendencyFrom(now, past([['2026-11-19T12:00:00+01:00', 8.9, 1]]))?.dir).toBe('down');
  });

  it('ignores forecasts, other stations and values too far from one hour ago', () => {
    expect(tendencyFrom(now, past([['2026-11-19T12:00:00+01:00', 5, 2]]))).toBeNull();
    expect(tendencyFrom(now, past([['2026-11-19T12:00:00+01:00', 5, 3]]))).toBeNull();
    expect(tendencyFrom(now, past([['2026-11-19T11:30:00+01:00', 5, 1]]))).toBeNull();
  });

  it('interpolates between hourly observations for a half-hourly reading', () => {
    const half = { timestamp: '2026-11-19T13:30:00+01:00', temperature: 8.3, stationId: '03379' };
    const t = tendencyFrom(half, past([['2026-11-19T12:00:00+01:00', 8.0, 1], ['2026-11-19T13:00:00+01:00', 8.4, 1]]));
    // 12:30 ≈ 8.2 → +0.1
    expect(t).toEqual({ delta: 0.1, dir: 'flat', from: '2026-11-19T12:30:00+01:00' });
  });
});
