import type { IconName } from '../components/Icon';
import { hourAgreement, median, rainConsensus, type ExtraVar } from './agreement';
import type { EcmwfForecast, MemberSet } from './api';
import { RAIN_THRESHOLD } from './config';
import { pointRateAt, type RadarData } from './radar';

export interface HourCard {
  /** Local "YYYY-MM-DDTHH:00", or "now". */
  time: string;
  label: string;
  icon: IconName;
  temp: number | null;
  /** Share of models with ≥ 0.1 mm (0–1); null for the nowcast card. */
  rainProbability: number | null;
  /** Expected precipitation in mm for this hour (median of models, or radar nowcast). */
  rainMm: number | null;
  source: 'radar' | 'modelle';
  /** Index into the model time axis, for the details. */
  index: number;
}

const nums = (a: (number | null | undefined)[]) => a.filter((v): v is number => typeof v === 'number');

/** Night if the hour lies before sunrise or after sunset of that day. */
function isNight(time: string, ecmwf: EcmwfForecast | null): boolean {
  if (!ecmwf) {
    const h = Number(time.slice(11, 13));
    return h < 7 || h >= 18;
  }
  const i = ecmwf.daily.time.indexOf(time.slice(0, 10));
  if (i < 0) return false;
  const hm = time.slice(11, 16);
  return hm < ecmwf.daily.sunrise[i].slice(11, 16) || hm >= ecmwf.daily.sunset[i].slice(11, 16);
}

export function iconFor(rainMm: number, rainP: number | null, cloud: number | null, temp: number | null, night: boolean): IconName {
  const wet = rainMm >= RAIN_THRESHOLD || (rainP != null && rainP >= 0.5);
  if (wet) {
    if (temp != null && temp <= 0.5) return 'snow';
    if (temp != null && temp <= 2) return 'sleet';
    return rainMm < 0.3 ? 'drizzle' : 'rain';
  }
  if (cloud == null) return 'cloud';
  if (cloud < 20) return night ? 'moon' : 'sun';
  if (cloud < 70) return night ? 'cloud' : 'partly';
  return 'cloud';
}

/**
 * Next 12 hours: the first card ("Jetzt") uses the radar nowcast for rain,
 * the following hours the median of the high-resolution models.
 */
export function nextHours(
  hires: MemberSet,
  nowKey: string,
  ecmwf: EcmwfForecast | null,
  radar: RadarData | null,
  currentTemp: number | null,
  hours = 12,
): HourCard[] {
  const start = hires.time.indexOf(nowKey);
  if (start < 0) return [];
  const cards: HourCard[] = [];
  for (let k = 0; k <= hours && start + k < hires.time.length; k++) {
    const i = start + k;
    const time = hires.time[i];
    const temps = nums(hires.members.map((m) => m.temperature[i]));
    const rains = nums(hires.members.map((m) => m.precipitation[i]));
    const clouds = nums(hires.members.map((m) => m.cloud?.[i]));
    if (!temps.length) break;
    let temp: number | null = median(temps);
    let rainMm = rains.length ? median(rains) : 0;
    let rainProbability: number | null = rains.length ? rains.filter((r) => r >= RAIN_THRESHOLD).length / rains.length : null;
    let source: HourCard['source'] = 'modelle';
    if (k === 0) {
      if (currentTemp != null) temp = currentTemp;
      if (radar) {
        // Sum of the 12 five-minute nowcast steps → mm in the next hour.
        let mm = 0;
        for (let s = 0; s < 12; s++) mm += pointRateAt(radar, radar.latestIndex + s) / 12;
        rainMm = mm;
        rainProbability = null;
        source = 'radar';
      }
    }
    cards.push({
      time,
      label: k === 0 ? 'Jetzt' : `${time.slice(11, 13)} Uhr`,
      icon: iconFor(rainMm, rainProbability, clouds.length ? median(clouds) : null, temp, isNight(time, ecmwf)),
      temp,
      rainProbability,
      rainMm,
      source,
      index: i,
    });
  }
  return cards;
}

export interface HourDetail {
  n: number;
  temp: number | null;
  tempRange: [number, number] | null;
  apparent: number | null;
  rainProbability: number | null;
  rainMembers: number;
  rainMm: number | null;
  wind: number | null;
  gust: number | null;
  /** Mean wind direction in degrees (vector average), null if unknown. */
  direction: number | null;
  cloud: number | null;
  humidity: number | null;
  /** Share of models within ±tolerance of the median. */
  tempAgreement: number | null;
  /** How clearly the models agree on rain yes/no (0.5–1). */
  rainConsensus: number | null;
}

/** Circular mean of directions in degrees. */
export function meanDirection(deg: number[]): number | null {
  if (!deg.length) return null;
  let x = 0;
  let y = 0;
  for (const d of deg) {
    x += Math.sin((d * Math.PI) / 180);
    y += Math.cos((d * Math.PI) / 180);
  }
  if (Math.hypot(x, y) < 1e-6) return null;
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
export const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

/** Median values and agreement of all models for one hour. */
export function hourDetail(set: MemberSet, i: number): HourDetail {
  const ex = (v: ExtraVar) => nums(set.members.map((m) => m.extra?.[v]?.[i]));
  const temps = nums(set.members.map((m) => m.temperature[i]));
  const rains = nums(set.members.map((m) => m.precipitation[i]));
  const clouds = nums(set.members.map((m) => m.cloud?.[i]));
  const med = (a: number[]) => (a.length ? median(a) : null);
  const a = hourAgreement(set.time, set.members, i);
  const rainMembers = rains.filter((r) => r >= RAIN_THRESHOLD).length;
  return {
    n: temps.length,
    temp: med(temps),
    tempRange: temps.length > 1 ? [Math.min(...temps), Math.max(...temps)] : null,
    apparent: med(ex('apparent_temperature')),
    rainProbability: rains.length ? rainMembers / rains.length : null,
    rainMembers,
    rainMm: med(rains),
    wind: med(ex('wind_speed_10m')),
    gust: med(ex('wind_gusts_10m')),
    direction: meanDirection(ex('wind_direction_10m')),
    cloud: med(clouds),
    humidity: med(ex('relative_humidity_2m')),
    tempAgreement: temps.length > 1 ? a.tempAgreement : null,
    rainConsensus: rainConsensus(rains.length ? rainMembers / rains.length : null),
  };
}
