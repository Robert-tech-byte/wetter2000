import { RAIN_THRESHOLD as RAIN } from './config';
import { intensityText, pointRateAt, type RadarData } from './radar';
import { clock } from './time';

/** Plain-language summary of the next 60 minutes at the city centre. */
export function nowcastSentence(data: RadarData): string {
  const start = data.latestIndex;
  const rates = data.frames.slice(start, start + 13).map((_, i) => ({
    ts: data.frames[start + i].timestamp,
    v: pointRateAt(data, start + i),
  }));
  if (!rates.length) return '';
  const now = rates[0].v;
  const first = rates.find((r) => r.v >= RAIN);
  const peak = Math.max(...rates.map((r) => r.v));
  if (!first) return 'In der nächsten Stunde bleibt es trocken.';
  if (now >= RAIN) {
    const dryIdx = rates.findIndex((r) => r.v < RAIN);
    const nowText = capital(intensityText(now));
    if (dryIdx < 0) return `${nowText} hält die nächste Stunde an.`;
    const later = rates.slice(dryIdx).filter((r) => r.v >= RAIN);
    if (!later.length) return `${nowText}, trocken ab etwa ${clock(rates[dryIdx].ts)}.`;
    const laterPeak = Math.max(...later.map((r) => r.v));
    return `${nowText} bis etwa ${clock(rates[dryIdx].ts)}, ab ${clock(later[0].ts)} ${intensityText(laterPeak)}.`;
  }
  return `${capital(intensityText(peak))} ab etwa ${clock(first.ts)}.`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

