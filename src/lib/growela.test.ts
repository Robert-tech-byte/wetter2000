import { describe, expect, it } from 'vitest';
import { classify, fromPhrase, meaning, reasons, regionName, trend } from './growela';
import type { PressureData } from './pressure';

const lats = Array.from({ length: 16 }, (_, i) => 35 + i * 2.5);
const lons = Array.from({ length: 29 }, (_, j) => -25 + j * 2.5);
const field = (f: (lat: number, lon: number) => number) => lats.map((la) => lons.map((lo) => f(la, lo)));
const data = (days: ((lat: number, lon: number) => number)[]): PressureData => ({
  source: 't',
  model: 't',
  generated: 't',
  lats,
  lons,
  days: days.map((f, k) => ({ date: `2026-11-${17 + k}`, p: field(f) })),
});

describe('growela', () => {
  it('pressure rising towards the east → southerly flow → SW/SO sector', () => {
    // p increases eastward: geostrophic wind from the south (low to the west).
    const g = classify(data([(_la, lo) => 1010 + lo * 0.6]), '2026-11-17')!;
    expect(g.fromDeg).not.toBeNull();
    expect(Math.round(g.fromDeg!)).toBe(180);
    expect(['SO', 'SW']).toContain(g.sector);
  });

  it('pressure falling towards the north → westerly flow (NW/SW boundary)', () => {
    const g = classify(data([(la) => 1030 - (la - 35) * 0.8]), '2026-11-17')!;
    expect(Math.round(g.fromDeg!)).toBe(270);
  });

  it('flat field → XX, anticyclonic under a high', () => {
    const g = classify(data([(la, lo) => 1030 - 0.08 * ((la - 48) ** 2 + (lo - 11.5) ** 2)]), '2026-11-17')!;
    expect(g.sector).toBe('XX');
    expect(g.cyclonic).toBe(false);
    expect(meaning(g, false)[0]).toMatch(/Nebel/);
    expect(g.highs[0].label).toBe('den Alpen');
  });

  it('low over the centre is cyclonic', () => {
    const g = classify(data([(la, lo) => 990 + 0.05 * ((la - 48) ** 2 + (lo - 11.5) ** 2)]), '2026-11-17')!;
    expect(g.cyclonic).toBe(true);
  });

  it('trend names the day the type changes', () => {
    const d = data([(_la, lo) => 1010 + lo * 0.6, (_la, lo) => 1010 + lo * 0.6, (la) => 1030 - (la - 35) * 0.8]);
    const list = ['2026-11-17', '2026-11-18', '2026-11-19'].map((x) => classify(d, x)!);
    expect(trend(list)).toMatch(/^Ab Donnerstag/);
  });

  it('from-phrases', () => {
    expect(fromPhrase('dem westlichen Mittelmeer')).toBe('vom westlichen Mittelmeer');
    expect(fromPhrase('den Britischen Inseln')).toBe('von den Britischen Inseln');
    expect(fromPhrase('der Biskaya')).toBe('von der Biskaya');
    expect(fromPhrase('Island')).toBe('aus Island');
  });

  it('region names', () => {
    expect(regionName(64, -18)).toBe('Island');
    expect(regionName(47.2, 19)).toBe('Ungarn');
  });

  it('reasons: origin, rising air, tendency, wind, föhn', () => {
    const d = data([(_la, lo) => 1010 + lo * 0.6, (_la, lo) => 1000 + lo * 0.6]);
    const list = ['2026-11-17', '2026-11-18'].map((x) => classify(d, x)!);
    const r = reasons(list, true);
    expect(r.map((x) => x.title)).toEqual(['Woher kommt die Luft?', 'Steigt oder sinkt die Luft?', 'Was kommt?', 'Wie windig?', 'Warum Föhn?']);
    expect(r[0].text).toMatch(/^Die Strömung führt Luft (vom|von der|von den|aus) /);
    expect(r[2].text).toMatch(/fällt der Luftdruck über München um etwa 10 hPa/);
  });
});
