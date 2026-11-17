import { LOCATION } from './config';

/** Kilometres per degree at Munich's latitude (local equirectangular projection). */
export const KM_PER_DEG_LAT = 111.32;
export const KM_PER_DEG_LON = 111.32 * Math.cos((LOCATION.lat * Math.PI) / 180);

export type LatLon = [number, number];
export type Km = [number, number];

/** [lat, lon] → [east, north] in km relative to the city centre. */
export function toKm([lat, lon]: LatLon): Km {
  return [(lon - LOCATION.lon) * KM_PER_DEG_LON, (lat - LOCATION.lat) * KM_PER_DEG_LAT];
}
