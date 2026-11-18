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
const wd = (date: string) => WD.format(new Date(`${date}T00:00:00Z`));
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

/** The next 14 days starting tomorrow. */
export function next14(data: TrendData, today: string): TrendDay[] {
  return data.days.filter((d) => d.date > today).slice(0, 14);
}

/** One or two plain sentences describing the trend (temperature, frost, rain). */
export function trendSummary(days: TrendDay[]): string {
  if (days.length < 4) return '';
  const parts: string[] = [];

  // Temperature: compare the first three days with the rest.
  const base = mean(days.slice(0, 3).map((d) => d.max.p50));
  const colder = days.slice(3).find((d) => d.max.p50 <= base - 4);
  const warmer = days.slice(3).find((d) => d.max.p50 >= base + 4);
  if (colder && (!warmer || colder.date < warmer.date)) parts.push(`Ab ${wd(colder.date)} deutlich kälter`);
  else if (warmer) parts.push(`Ab ${wd(warmer.date)} deutlich wärmer`);
  else parts.push('Temperaturen ohne große Änderung');

  // Frost
  const frost = days.find((d) => d.min.p50 <= -0.5);
  const frostMaybe = days.find((d) => d.min.p25 <= -0.5);
  if (frost) parts.push(`Nachtfrost wahrscheinlich ab ${wd(frost.date)}`);
  else if (frostMaybe) parts.push(`Nachtfrost möglich ab ${wd(frostMaybe.date)}`);

  // Rain
  const wet = days.filter((d) => d.rain.prob >= 0.6);
  let rain: string;
  if (!wet.length) rain = days.every((d) => d.rain.prob < 0.35) ? 'Überwiegend trocken.' : 'Kein Tag mit hoher Regenwahrscheinlichkeit.';
  else if (wet.every((d) => isWeekend(d.date))) rain = 'Regen vor allem am Wochenende.';
  else rain = `Regen am wahrscheinlichsten am ${wet.slice(0, 2).map((d) => wd(d.date)).join(' und ')}.`;

  return `${parts.join(', ')}. ${rain}`;
}
