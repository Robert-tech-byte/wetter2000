import { LOCATION } from './config';
import { extrema, type Extremum, type PressureData } from './pressure';

/**
 * Simplified "Großwetterlage" in the spirit of the DWD objective weather-type
 * classification: inflow sector from the geostrophic wind over southern Germany
 * plus cyclonic/anticyclonic from the curvature of the pressure field.
 */
export type Sector = 'NO' | 'SO' | 'SW' | 'NW' | 'XX';

export interface Growela {
  date: string;
  sector: Sector;
  cyclonic: boolean;
  /** Direction the air comes from (degrees), null when the gradient is too weak. */
  fromDeg: number | null;
  /** Pressure gradient strength (hPa per 1000 km). */
  gradient: number;
  name: string;
  highs: { label: string; value: number }[];
  lows: { label: string; value: number }[];
}

const SECTOR_NAME: Record<Sector, string> = {
  NO: 'Nordostlage',
  SO: 'Südostlage',
  SW: 'Südwestlage',
  NW: 'Nordwestlage',
  XX: 'Lage ohne klare Strömung',
};

/** Named regions for describing where highs and lows sit. */
const REGIONS: [string, number, number][] = [
  ['Island', 64.5, -19],
  ['dem Nordatlantik', 55, -22],
  ['den Britischen Inseln', 54, -3],
  ['der Biskaya', 45.5, -5],
  ['der Iberischen Halbinsel', 40, -4],
  ['Frankreich', 47, 2.5],
  ['der Nordsee', 56, 3.5],
  ['Skandinavien', 62, 14],
  ['der Ostsee', 57, 19],
  ['Deutschland', 51, 10],
  ['den Alpen', 46.5, 11],
  ['Polen', 52, 19.5],
  ['Ungarn', 47, 19.5],
  ['dem Balkan', 43, 21],
  ['Italien', 42.5, 12.5],
  ['dem westlichen Mittelmeer', 39.5, 5],
  ['dem östlichen Mittelmeer', 36, 24],
  ['Westrussland', 55, 38],
  ['dem Schwarzen Meer', 43.5, 34],
];

export function regionName(lat: number, lon: number): string {
  let best = REGIONS[0];
  let bd = Infinity;
  for (const r of REGIONS) {
    const d = (r[1] - lat) ** 2 + ((r[2] - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bd) {
      bd = d;
      best = r;
    }
  }
  return best[0];
}

function at(data: PressureData, grid: (number | null)[][], lat: number, lon: number): number | null {
  // Bilinear sample on the regular grid.
  const { lats, lons } = data;
  const fi = (lat - lats[0]) / (lats[1] - lats[0]);
  const fj = (lon - lons[0]) / (lons[1] - lons[0]);
  const i0 = Math.floor(fi);
  const j0 = Math.floor(fj);
  if (i0 < 0 || j0 < 0 || i0 + 1 >= lats.length || j0 + 1 >= lons.length) return null;
  const v = [grid[i0][j0], grid[i0][j0 + 1], grid[i0 + 1][j0], grid[i0 + 1][j0 + 1]];
  if (v.some((x) => x == null)) return null;
  const ti = fi - i0;
  const tj = fj - j0;
  return (v[0]! * (1 - tj) + v[1]! * tj) * (1 - ti) + (v[2]! * (1 - tj) + v[3]! * tj) * ti;
}

const KM_PER_DEG = 111.32;
/** Gradient below this (hPa / 1000 km) counts as "no clear inflow". */
export const WEAK_GRADIENT = 4;

export function classify(data: PressureData, date: string): Growela | null {
  const day = data.days.find((d) => d.date === date);
  if (!day) return null;
  const lat = LOCATION.lat;
  const lon = LOCATION.lon;
  const d = 4; // half-width of the stencil in degrees
  const pN = at(data, day.p, lat + d, lon);
  const pS = at(data, day.p, lat - d, lon);
  const pE = at(data, day.p, lat, lon + d);
  const pW = at(data, day.p, lat, lon - d);
  const pC = at(data, day.p, lat, lon);
  if ([pN, pS, pE, pW, pC].some((x) => x == null)) return null;
  const dy = 2 * d * KM_PER_DEG;
  const dx = 2 * d * KM_PER_DEG * Math.cos((lat * Math.PI) / 180);
  const dpdx = ((pE! - pW!) / dx) * 1000; // hPa per 1000 km, eastward
  const dpdy = ((pN! - pS!) / dy) * 1000; // northward
  // Geostrophic wind (northern hemisphere): low pressure to the left of the flow.
  const u = -dpdy;
  const v = dpdx;
  const gradient = Math.hypot(dpdx, dpdy);
  const fromDeg = gradient < WEAK_GRADIENT ? null : (Math.atan2(-u, -v) * 180) / Math.PI + 360;
  const from = fromDeg == null ? null : fromDeg % 360;
  const sector: Sector = from == null ? 'XX' : from < 90 ? 'NO' : from < 180 ? 'SO' : from < 270 ? 'SW' : 'NW';
  // Curvature: centre below the mean of its neighbours → cyclonic.
  const cyclonic = pC! < (pN! + pS! + pE! + pW!) / 4;

  const marks = extrema(day.p, data.lats, data.lons);
  const near = (m: Extremum) => Math.hypot(m.lat - lat, (m.lon - lon) * Math.cos((lat * Math.PI) / 180));
  const describe = (kind: 'H' | 'T') =>
    marks
      .filter((m) => m.kind === kind)
      .sort((a, b) => near(a) - near(b))
      .slice(0, 2)
      .map((m) => ({ label: regionName(m.lat, m.lon), value: Math.round(m.value) }));

  return {
    date,
    sector,
    cyclonic,
    fromDeg: from,
    gradient,
    name: `${SECTOR_NAME[sector]}, ${cyclonic ? 'zyklonal' : 'antizyklonal'}`,
    highs: describe('H'),
    lows: describe('T'),
  };
}

const WINTER = (date: string) => {
  const m = Number(date.slice(5, 7));
  return m >= 10 || m <= 3;
};

/** Plain-language consequences for Munich. */
export function meaning(g: Growela, foehn: boolean): string[] {
  const winter = WINTER(g.date);
  const out: string[] = [];
  const key = `${g.sector}${g.cyclonic ? 'z' : 'a'}`;
  const rules: Record<string, string> = {
    SWa: 'Milde Luft aus Südwesten, meist trocken. Am Alpenrand oft Föhn mit guter Fernsicht.',
    SWz: 'Tiefausläufer ziehen durch: mild, windig, zeitweise Regen.',
    NWa: 'Kühlere Luft vom Atlantik, meist trocken mit wechselnder Bewölkung.',
    NWz: `Unbeständig und kühler, Schauer. Am Alpenrand staut sich die Luft (Nordstau), dort mehr ${winter ? 'Schnee' : 'Regen'}.`,
    NOa: winter ? 'Trockene, kalte Kontinentalluft, oft klar und frostig.' : 'Trockene Festlandsluft, sonnig und warm.',
    NOz: 'Kühle, feuchte Luft aus Nordosten, viele Wolken, zeitweise Niederschlag.',
    SOa: winter ? 'Trockene, kalte Luft aus Osteuropa, oft sonnig.' : 'Trockene, heiße Luft aus Südosten, sonnig.',
    SOz: 'Tief im Süden oder Osten: Gefahr von länger anhaltendem, kräftigem Niederschlag.',
    XXa: winter
      ? 'Hochdruck ohne Wind: in den Niederungen Nebel und Hochnebel (Inversion), in den Bergen oft Sonne.'
      : 'Hochdruck, schwacher Wind: viel Sonne, nachmittags einzelne Wärmegewitter möglich.',
    XXz: 'Flaches Tief, schwacher Wind: unbeständig, Schauer und Gewitter möglich.',
  };
  out.push(rules[key]);
  if (foehn) out.push('Heute ist Föhn wahrscheinlich: warm und trocken, Alpenblick bis zur Zugspitze.');
  return out;
}

const DAY = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' });

/** Trend sentence for the next days, or null when the weather type stays the same. */
export function trend(list: Growela[]): string | null {
  if (list.length < 2) return null;
  const today = list[0];
  const change = list.slice(1).find((g) => g.sector !== today.sector || g.cyclonic !== today.cyclonic);
  if (!change) return `Die Lage bleibt in den nächsten ${list.length - 1} Tagen weitgehend gleich.`;
  const wd = DAY.format(new Date(`${change.date}T00:00:00Z`));
  return `Ab ${wd} stellt sich die Wetterlage um: ${change.name}.`;
}
