/** 15-day ensemble trend (built every 6 h by scripts/build-trend.py). */
export interface Pct {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}
export interface TrendDay {
  date: string;
  max: Pct;
  min: Pct;
  rain: { p50: number; p90: number; prob: number };
  members: number;
}
export interface TrendData {
  source: string;
  model: string;
  generated: string;
  days: TrendDay[];
}

const WD = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' });
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

/** Weekday name; from the second week on with the date, because weekday names repeat. */
function dayName(days: TrendDay[], date: string): string {
  const name = WD.format(new Date(`${date}T00:00:00Z`));
  if (days.findIndex((d) => d.date === date) < 7) return name;
  return `${name} (${Number(date.slice(8, 10))}.${Number(date.slice(5, 7))}.)`;
}

/** A day counts as rainy when most runs bring rain and the median sum is noticeable. */
export const RAIN_PROB = 0.6;
export const RAIN_MM = 1;
const isWet = (d: TrendDay) => d.rain.prob >= RAIN_PROB && d.rain.p50 >= RAIN_MM;

/** The next 14 days starting tomorrow. */
export function next14(data: TrendData, today: string): TrendDay[] {
  return data.days.filter((d) => d.date > today).slice(0, 14);
}

function rainSentence(days: TrendDay[]): string {
  const name = (d: TrendDay) => dayName(days, d.date);
  const wet = days.filter(isWet);
  if (!wet.length) {
    return days.every((d) => d.rain.prob < 0.35) ? 'Überwiegend trocken.' : 'Kein Tag mit viel Regen in Sicht.';
  }
  if (wet.every((d) => isWeekend(d.date)) && wet.length <= 2) return 'Regen vor allem am Wochenende.';
  // First stretch of consecutive rainy days.
  const i0 = days.findIndex(isWet);
  let i1 = i0;
  while (i1 + 1 < days.length && isWet(days[i1 + 1])) i1++;
  let first: string;
  if (i0 === i1) first = `Regen vor allem am ${name(days[i0])}`;
  else if (i0 === 0) first = `Regen bis ${name(days[i1])}`;
  else first = `Regen von ${name(days[i0])} bis ${name(days[i1])}`;
  const later = days.slice(i1 + 1).filter(isWet).length;
  const rest = i1 === days.length - 1 ? '' : later === 0 ? ', danach überwiegend trocken' : later >= 3 ? ', danach weiter wechselhaft' : ', danach meist trocken';
  return `${first}${rest}.`;
}

/** One or two plain sentences describing the trend (temperature, frost, rain). */
export function trendSummary(days: TrendDay[]): string {
  if (days.length < 4) return '';
  const name = (d: TrendDay) => dayName(days, d.date);
  const parts: string[] = [];

  // Temperature: compare the first two days with the rest (daily maximum, median).
  const base = mean(days.slice(0, 2).map((d) => d.max.p50));
  const colder = days.slice(2).find((d) => d.max.p50 <= base - 3.5);
  const warmer = days.slice(2).find((d) => d.max.p50 >= base + 3.5);
  if (colder && (!warmer || colder.date < warmer.date)) parts.push(`Ab ${name(colder)} deutlich kälter`);
  else if (warmer) parts.push(`Ab ${name(warmer)} deutlich wärmer`);
  else parts.push('Temperaturen ohne große Änderung');

  // Frost
  const frost = days.find((d) => d.min.p50 <= -0.5);
  const frostMaybe = days.find((d) => d.min.p25 <= -0.5);
  if (frost) parts.push(`Nachtfrost wahrscheinlich ab ${name(frost)}`);
  else if (frostMaybe) parts.push(`Nachtfrost möglich ab ${name(frostMaybe)}`);

  return `${parts.join(', ')}. ${rainSentence(days)}`;
}
