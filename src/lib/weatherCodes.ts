/** WMO weather interpretation codes (as used by Open-Meteo). */
const CODES: Record<number, [string, string]> = {
  0: ['Klar', '☀️'],
  1: ['Überwiegend klar', '🌤️'],
  2: ['Teilweise bewölkt', '⛅'],
  3: ['Bedeckt', '☁️'],
  45: ['Nebel', '🌫️'],
  48: ['Reifnebel', '🌫️'],
  51: ['Leichter Nieselregen', '🌦️'],
  53: ['Nieselregen', '🌦️'],
  55: ['Starker Nieselregen', '🌧️'],
  56: ['Gefrierender Niesel', '🌧️'],
  57: ['Gefrierender Niesel', '🌧️'],
  61: ['Leichter Regen', '🌦️'],
  63: ['Regen', '🌧️'],
  65: ['Starker Regen', '🌧️'],
  66: ['Gefrierender Regen', '🌧️'],
  67: ['Gefrierender Regen', '🌧️'],
  71: ['Leichter Schneefall', '🌨️'],
  73: ['Schneefall', '🌨️'],
  75: ['Starker Schneefall', '❄️'],
  77: ['Schneegriesel', '🌨️'],
  80: ['Leichte Regenschauer', '🌦️'],
  81: ['Regenschauer', '🌧️'],
  82: ['Heftige Regenschauer', '⛈️'],
  85: ['Schneeschauer', '🌨️'],
  86: ['Starke Schneeschauer', '❄️'],
  95: ['Gewitter', '⛈️'],
  96: ['Gewitter mit Hagel', '⛈️'],
  99: ['Gewitter mit Hagel', '⛈️'],
};

export function describeWeather(code: number | null | undefined): { text: string; icon: string } {
  if (code == null || !(code in CODES)) return { text: '–', icon: '❔' };
  const [text, icon] = CODES[code];
  return { text, icon };
}

/** Bright Sky icon names → emoji / text. */
const BRIGHTSKY_ICONS: Record<string, [string, string]> = {
  'clear-day': ['Klar', '☀️'],
  'clear-night': ['Klar', '🌙'],
  'partly-cloudy-day': ['Teilweise bewölkt', '⛅'],
  'partly-cloudy-night': ['Teilweise bewölkt', '☁️'],
  cloudy: ['Bedeckt', '☁️'],
  fog: ['Nebel', '🌫️'],
  wind: ['Windig', '💨'],
  rain: ['Regen', '🌧️'],
  sleet: ['Schneeregen', '🌨️'],
  snow: ['Schnee', '❄️'],
  hail: ['Hagel', '🌨️'],
  thunderstorm: ['Gewitter', '⛈️'],
};

export function describeBrightSkyIcon(icon: string | null | undefined): { text: string; icon: string } {
  if (!icon || !(icon in BRIGHTSKY_ICONS)) return { text: '–', icon: '❔' };
  const [text, emoji] = BRIGHTSKY_ICONS[icon];
  return { text, icon: emoji };
}
