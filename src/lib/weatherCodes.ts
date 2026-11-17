import type { IconName } from '../components/Icon';

/** WMO weather interpretation codes (as used by Open-Meteo). */
const CODES: Record<number, [string, IconName]> = {
  0: ['Klar', 'sun'],
  1: ['Überwiegend klar', 'partly'],
  2: ['Teilweise bewölkt', 'partly'],
  3: ['Bedeckt', 'cloud'],
  45: ['Nebel', 'fog'],
  48: ['Reifnebel', 'fog'],
  51: ['Leichter Nieselregen', 'drizzle'],
  53: ['Nieselregen', 'drizzle'],
  55: ['Starker Nieselregen', 'drizzle'],
  56: ['Gefrierender Niesel', 'sleet'],
  57: ['Gefrierender Niesel', 'sleet'],
  61: ['Leichter Regen', 'rain'],
  63: ['Regen', 'rain'],
  65: ['Starker Regen', 'rain'],
  66: ['Gefrierender Regen', 'sleet'],
  67: ['Gefrierender Regen', 'sleet'],
  71: ['Leichter Schneefall', 'snow'],
  73: ['Schneefall', 'snow'],
  75: ['Starker Schneefall', 'snow'],
  77: ['Schneegriesel', 'snow'],
  80: ['Leichte Schauer', 'rain'],
  81: ['Regenschauer', 'rain'],
  82: ['Heftige Schauer', 'rain'],
  85: ['Schneeschauer', 'snow'],
  86: ['Starke Schneeschauer', 'snow'],
  95: ['Gewitter', 'thunder'],
  96: ['Gewitter mit Hagel', 'thunder'],
  99: ['Gewitter mit Hagel', 'thunder'],
};

export interface Condition {
  text: string;
  icon: IconName;
}

export function describeWeather(code: number | null | undefined): Condition {
  if (code == null || !(code in CODES)) return { text: '–', icon: 'cloud' };
  const [text, icon] = CODES[code];
  return { text, icon };
}

/** Bright Sky icon names. */
const BRIGHTSKY: Record<string, Condition> = {
  'clear-day': { text: 'Klar', icon: 'sun' },
  'clear-night': { text: 'Klar', icon: 'moon' },
  'partly-cloudy-day': { text: 'Teilweise bewölkt', icon: 'partly' },
  'partly-cloudy-night': { text: 'Teilweise bewölkt', icon: 'cloud' },
  cloudy: { text: 'Bedeckt', icon: 'cloud' },
  fog: { text: 'Nebel', icon: 'fog' },
  wind: { text: 'Windig', icon: 'wind' },
  rain: { text: 'Regen', icon: 'rain' },
  sleet: { text: 'Schneeregen', icon: 'sleet' },
  snow: { text: 'Schnee', icon: 'snow' },
  hail: { text: 'Hagel', icon: 'sleet' },
  thunderstorm: { text: 'Gewitter', icon: 'thunder' },
};

export function describeBrightSkyIcon(icon: string | null | undefined): Condition | null {
  return icon && icon in BRIGHTSKY ? BRIGHTSKY[icon] : null;
}
