import { LOCATION } from './config';

/** Current local time in Munich as "YYYY-MM-DDTHH:00" (matches Open-Meteo hourly keys). */
export function localHourKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LOCATION.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`;
}

const WEEKDAY = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });
const DAYMONTH = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** "2026-11-17" → Date at UTC midnight (pure calendar date). */
function dateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function formatDayShort(iso: string): string {
  return `${WEEKDAY.format(dateOnly(iso))} ${DAYMONTH.format(dateOnly(iso))}`;
}

export function relativeDayName(iso: string, todayIso: string): string {
  const diff = Math.round((dateOnly(iso).getTime() - dateOnly(todayIso).getTime()) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  if (diff === 2) return 'Übermorgen';
  return WEEKDAY.format(dateOnly(iso));
}

/** Local-time string "YYYY-MM-DDTHH:MM" → "HH:MM". */
export function hhmm(localIso: string): string {
  return localIso.slice(11, 16);
}

const CLOCK = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: LOCATION.timezone,
});

/** Absolute timestamp (with offset) → "HH:MM" in Munich time. */
export function clock(ts: string | Date): string {
  return CLOCK.format(typeof ts === 'string' ? new Date(ts) : ts);
}
