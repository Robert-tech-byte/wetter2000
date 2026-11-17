import type { IconName } from '../components/Icon';
import { median } from './agreement';
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
    });
  }
  return cards;
}
