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
  /** Sea-level pressure over Munich at 12:00 (hPa). */
  pCenter: number;
  /** Nearest low / high (distance in km). */
  nearLow: { label: string; value: number; km: number } | null;
  nearHigh: { label: string; value: number; km: number } | null;
  /** Why the type counts as cyclonic or anticyclonic (plain language). */
  basis: string;
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
  ['Nordafrika', 31, 5],
  ['dem Atlantik vor Portugal', 40, -16],
  ['dem Europäischen Nordmeer', 68, 0],
  ['der Arktis', 76, 20],
  ['Russland', 58, 48],
  ['der Ukraine', 49, 32],
  ['der Türkei', 39, 33],
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
/** Thresholds for cyclonic / anticyclonic (see classify). */
export const LOW_PRESSURE = 1005;
export const HIGH_PRESSURE = 1020;
export const LOW_RADIUS_KM = 1000;
export const HIGH_RADIUS_KM = 800;
/** Gradient above which the weather counts as windy (hPa / 1000 km). */
export const WINDY_GRADIENT = 12;

const roundKm = (km: number) => Math.round(km / 50) * 50;
const COMPASS8 = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] as const;
const compass8 = (deg: number) => COMPASS8[Math.round(deg / 45) % 8];
/** Plain direction for the name; the 4-sector scheme still drives the rules. */
const PLAIN: Record<(typeof COMPASS8)[number], string> = {
  N: 'Nord',
  NO: 'Nordost',
  O: 'Ost',
  SO: 'Südost',
  S: 'Süd',
  SW: 'Südwest',
  W: 'West',
  NW: 'Nordwest',
};
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
  const marks = extrema(day.p, data.lats, data.lons);
  const near = (m: Extremum) => Math.hypot(m.lat - lat, (m.lon - lon) * Math.cos((lat * Math.PI) / 180));
  const nearest = (kind: 'H' | 'T') => {
    const m = marks.filter((x) => x.kind === kind).sort((a, b) => near(a) - near(b))[0];
    return m ? { label: regionName(m.lat, m.lon), value: Math.round(m.value), km: Math.round(near(m) * KM_PER_DEG) } : null;
  };
  const nearLow = nearest('T');
  const nearHigh = nearest('H');

  // Cyclonic or anticyclonic. The local curvature alone misleads on the flank of a deep
  // low (a very low northern neighbour makes Munich look "higher" than its surroundings),
  // so pressure level and the nearest systems decide first, curvature only in between.
  const curvature = (pN! + pS! + pE! + pW!) / 4 - pC!; // > 0: centre lower → cyclonic
  const lowClose = nearLow != null && nearLow.km <= LOW_RADIUS_KM && (nearHigh == null || nearLow.km < nearHigh.km);
  const highClose = nearHigh != null && nearHigh.km <= HIGH_RADIUS_KM && (nearLow == null || nearHigh.km < nearLow.km);
  let cyclonic: boolean;
  let basis: string;
  if (pC! <= LOW_PRESSURE) {
    cyclonic = true;
    basis = `Der Luftdruck über München ist mit ${Math.round(pC!)} hPa niedrig.`;
  } else if (pC! >= HIGH_PRESSURE) {
    cyclonic = false;
    basis = `Der Luftdruck über München ist mit ${Math.round(pC!)} hPa hoch.`;
  } else if (lowClose) {
    cyclonic = true;
    basis = `Ein Tief über ${nearLow!.label} liegt nur rund ${roundKm(nearLow!.km)} km entfernt.`;
  } else if (highClose) {
    cyclonic = false;
    basis = `Ein Hoch über ${nearHigh!.label} liegt nur rund ${roundKm(nearHigh!.km)} km entfernt.`;
  } else {
    cyclonic = curvature > 0;
    basis = cyclonic
      ? 'Der Luftdruck über München ist etwas niedriger als ringsum.'
      : 'Der Luftdruck über München ist etwas höher als ringsum.';
  }
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
    pCenter: pC!,
    nearLow,
    nearHigh,
    basis,
    name: `${from == null ? SECTOR_NAME.XX : `${PLAIN[compass8(from)]}lage`}, ${cyclonic ? 'zyklonal' : 'antizyklonal'}`,
    highs: describe('H'),
    lows: describe('T'),
  };
}

const WINTER = (date: string) => {
  const m = Number(date.slice(5, 7));
  return m >= 10 || m <= 3;
};

const FROM_PLAIN: Record<Sector, string> = {
  NO: 'Nordost',
  SO: 'Südost',
  SW: 'Südwest',
  NW: 'Nordwest',
  XX: 'wechselnder Richtung',
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
  const windy = g.gradient >= WINDY_GRADIENT;
  // Calm-weather texts (fog, inversion, "meist trocken") don't fit a strong gradient.
  if (windy && !g.cyclonic) {
    out.push(
      `Kräftige Strömung aus ${FROM_PLAIN[g.sector]} am Rand eines Tiefs: windig, wechselnd bewölkt, zeitweise Schauer möglich.`,
    );
  } else {
    out.push(rules[key]);
  }
  if (windy) out.push('Lebhafter bis stürmischer Wind, vor allem in Böen.');
  if (foehn) out.push('Heute ist Föhn wahrscheinlich: warm und trocken, Alpenblick bis zur Zugspitze.');
  return out;
}

const DAY = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' });

/** Trend sentence for the next days, or null when the weather type stays the same. */
export function trend(list: Growela[]): string | null {
  if (list.length < 2) return null;
  const today = list[0];
  // Compare what the reader sees (the name), not the internal 4-sector scheme.
  const change = list.slice(1).find((g) => g.name !== today.name);
  if (!change) return `Die Lage bleibt in den nächsten ${list.length - 1} Tagen weitgehend gleich.`;
  const wd = DAY.format(new Date(`${change.date}T00:00:00Z`));
  return `Ab ${wd} stellt sich die Wetterlage um: ${change.name}.`;
}

export interface Reason {
  title: string;
  text: string;
}

/** "dem westlichen Mittelmeer" → "vom westlichen Mittelmeer", "Island" → "aus Island". */
export function fromPhrase(region: string): string {
  if (region.startsWith('dem ')) return `vom ${region.slice(4)}`;
  if (region.startsWith('den ')) return `von den ${region.slice(4)}`;
  if (region.startsWith('der ')) return `von der ${region.slice(4)}`;
  return `aus ${region}`;
}

/** Point `km` upstream of Munich along the inflow direction. */
function upstream(fromDeg: number, km: number): [number, number] {
  const rad = (fromDeg * Math.PI) / 180;
  const lat = LOCATION.lat + (Math.cos(rad) * km) / KM_PER_DEG;
  const lon = LOCATION.lon + (Math.sin(rad) * km) / (KM_PER_DEG * Math.cos((LOCATION.lat * Math.PI) / 180));
  return [lat, lon];
}

const AIR: Record<Exclude<Sector, 'XX'>, (winter: boolean) => string> = {
  SW: () => 'Diese Luft stammt aus südlichen Breiten und ist deshalb vergleichsweise warm, über dem Meer hat sie Feuchtigkeit aufgenommen.',
  NW: () => 'Diese Luft kommt über den Atlantik aus nördlichen Breiten: kühl und feucht, oft mit Schauern.',
  NO: (w) =>
    w
      ? 'Diese Luft hat lange über dem Festland gelegen: trocken und im Winterhalbjahr kalt.'
      : 'Diese Luft hat lange über dem Festland gelegen: trocken, im Sommer warm.',
  SO: (w) =>
    w
      ? 'Diese Luft kommt über Osteuropa: trocken, im Winterhalbjahr kalt.'
      : 'Diese Luft kommt über Osteuropa und den Balkan: trocken und warm.',
};

/**
 * Cause-and-effect explanation: where the air comes from, rising or sinking air,
 * what is coming (pressure tendency), how windy, and the Föhn mechanism.
 */
export function reasons(list: Growela[], foehn: boolean): Reason[] {
  const g = list[0];
  if (!g) return [];
  const winter = WINTER(g.date);
  const out: Reason[] = [];

  // 1. Origin of the air
  if (g.fromDeg == null || g.sector === 'XX') {
    out.push({
      title: 'Woher kommt die Luft?',
      text: 'Es gibt kaum Druckgefälle, deshalb bewegt sich die Luft kaum. Sie bleibt über der Region und nimmt deren Eigenschaften an: Nachts kühlt sie aus, tagsüber erwärmt sie sich in der Sonne.',
    });
  } else {
    const [la, lo] = upstream(g.fromDeg, 1300);
    out.push({
      title: 'Woher kommt die Luft?',
      text: `Die Strömung führt Luft ${fromPhrase(regionName(la, lo))} heran. ${AIR[g.sector](winter)}`,
    });
  }

  // 2. Rising or sinking air – based on the same basis as the classification
  const windy = g.gradient >= WINDY_GRADIENT;
  out.push(
    g.cyclonic
      ? {
          title: 'Steigt oder sinkt die Luft?',
          text: `${g.basis} Im Bereich eines Tiefs steigt die Luft auf, kühlt dabei ab, und ihre Feuchtigkeit kondensiert zu Wolken. Deshalb ist es eher bewölkt, und Niederschlag ist wahrscheinlicher (zyklonal).`,
        }
      : {
          title: 'Steigt oder sinkt die Luft?',
          text:
            winter && !windy && g.pCenter >= 1015
              ? `${g.basis} Unter Hochdruckeinfluss sinkt die Luft ab und erwärmt sich, Wolken lösen sich auf (antizyklonal). Im Winterhalbjahr bleibt dabei kalte Luft am Boden liegen, darüber liegt wärmere (Inversion). Das begünstigt Nebel und Hochnebel, während es in den Bergen oft sonnig ist.`
              : `${g.basis} Unter Hochdruckeinfluss sinkt die Luft ab und erwärmt sich, Wolken lösen sich eher auf (antizyklonal).${windy ? ' Wegen des kräftigen Druckgefälles bleibt es trotzdem windig.' : ''}`,
        },
  );

  // 3. What is coming: pressure tendency until tomorrow noon
  if (list[1]) {
    const dp = list[1].pCenter - g.pCenter;
    const v = Math.abs(Math.round(dp));
    out.push({
      title: 'Was kommt?',
      text:
        dp <= -4
          ? `Bis morgen Mittag fällt der Luftdruck über München um etwa ${v} hPa. Ein Tief oder eine Front nähert sich, das Wetter wird unbeständiger.`
          : dp >= 4
            ? `Bis morgen Mittag steigt der Luftdruck über München um etwa ${v} hPa. Hochdruck setzt sich durch, das Wetter beruhigt sich.`
            : 'Der Luftdruck bleibt bis morgen Mittag etwa gleich. Eine große Umstellung ist vorerst nicht in Sicht.',
    });
  }

  // 4. Wind from the gradient (≈10 hPa / 1000 km ≈ 35 km/h geostrophic wind at this latitude)
  out.push({
    title: 'Wie windig?',
    text:
      g.gradient < 4
        ? 'Das Druckgefälle ist gering, der Wind schwach.'
        : g.gradient < 10
          ? 'Das Druckgefälle ist mäßig, der Wind schwach bis mäßig.'
          : g.gradient < 18
            ? 'Das Druckgefälle ist kräftig: lebhafter Wind mit Böen.'
            : 'Das Druckgefälle ist sehr stark: stürmischer Wind möglich.',
  });

  // 5. Föhn mechanism
  if (foehn) {
    out.push({
      title: 'Warum Föhn?',
      text: 'Südliche Luft wird an den Alpen zum Aufsteigen gezwungen, regnet sich auf der Südseite ab und verliert ihre Feuchtigkeit. Auf der Nordseite sinkt sie ab und erwärmt sich dabei stärker, als sie sich beim Aufsteigen abgekühlt hat. In München kommt sie deshalb warm und sehr trocken an, mit klarer Fernsicht auf die Berge.',
    });
  }
  return out;
}
