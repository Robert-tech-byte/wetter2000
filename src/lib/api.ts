import { AGREEMENT_DAYS, EPS_MODEL, FORECAST_DAYS, HIRES_MODELS, LOCATION } from './config';
import { EXTRA_VARS, type Member } from './agreement';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const BRIGHT_SKY = 'https://api.brightsky.dev';

async function getJson<T>(url: string, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body.reason ?? body.detail ?? '';
        } catch {
          /* ignore */
        }
        throw new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function params(extra: Record<string, string | number>): string {
  const p = new URLSearchParams({
    latitude: String(LOCATION.lat),
    longitude: String(LOCATION.lon),
    timezone: LOCATION.timezone,
  });
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return p.toString();
}

// ---------- ECMWF 15-day forecast ----------

export interface EcmwfForecast {
  daily: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
    wind_speed_10m_max: (number | null)[];
    wind_gusts_10m_max: (number | null)[];
    sunrise: string[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    precipitation: (number | null)[];
  };
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    precipitation: number;
  };
}

export function fetchEcmwf(): Promise<EcmwfForecast> {
  return getJson(
    `${OPEN_METEO}?${params({
      models: 'ecmwf_ifs',
      forecast_days: FORECAST_DAYS,
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset',
      hourly: 'temperature_2m,precipitation',
      current: 'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,precipitation',
    })}`,
  );
}

// ---------- High-resolution multi-model + ensemble ----------

interface HourlyResponse {
  hourly: Record<string, (number | null)[] | string[]>;
}

export interface MemberSet {
  time: string[];
  members: Member[];
}

export async function fetchHiresModels(): Promise<MemberSet> {
  const data = await getJson<HourlyResponse>(
    `${OPEN_METEO}?${params({
      models: HIRES_MODELS.map((m) => m.id).join(','),
      forecast_days: AGREEMENT_DAYS,
      hourly: ['temperature_2m', 'precipitation', 'cloud_cover', ...EXTRA_VARS].join(','),
    })}`,
  );
  const h = data.hourly;
  return {
    time: h.time as string[],
    members: HIRES_MODELS.map((m) => ({
      id: m.id,
      label: m.name,
      temperature: (h[`temperature_2m_${m.id}`] as (number | null)[]) ?? [],
      precipitation: (h[`precipitation_${m.id}`] as (number | null)[]) ?? [],
      cloud: (h[`cloud_cover_${m.id}`] as (number | null)[]) ?? [],
      extra: Object.fromEntries(EXTRA_VARS.map((v) => [v, (h[`${v}_${m.id}`] as (number | null)[]) ?? []])),
    })),
  };
}

export async function fetchEnsemble(): Promise<MemberSet> {
  const data = await getJson<HourlyResponse>(
    `${OPEN_METEO_ENSEMBLE}?${params({
      models: EPS_MODEL.id,
      forecast_days: AGREEMENT_DAYS,
      hourly: 'temperature_2m,precipitation',
    })}`,
  );
  const h = data.hourly;
  const members: Member[] = [];
  for (let i = 0; i < 100; i++) {
    const suffix = i === 0 ? '' : `_member${String(i).padStart(2, '0')}`;
    const t = h[`temperature_2m${suffix}`] as (number | null)[] | undefined;
    if (!t) {
      if (i === 0) continue;
      break;
    }
    members.push({
      id: `eps${i}`,
      label: i === 0 ? 'Kontrolllauf' : `Lauf ${i}`,
      temperature: t,
      precipitation: (h[`precipitation${suffix}`] as (number | null)[]) ?? [],
    });
  }
  return { time: h.time as string[], members };
}

// ---------- Bright Sky (DWD) ----------

export interface CurrentObservation {
  weather: {
    timestamp: string;
    temperature: number | null;
    relative_humidity: number | null;
    wind_speed_10: number | null;
    wind_gust_speed_10: number | null;
    precipitation_60: number | null;
    pressure_msl: number | null;
    cloud_cover: number | null;
    icon: string | null;
  };
  sources: { id: number; station_name: string; distance: number }[];
}

export function fetchCurrentObservation(): Promise<CurrentObservation> {
  return getJson(
    `${BRIGHT_SKY}/current_weather?lat=${LOCATION.lat}&lon=${LOCATION.lon}&tz=${encodeURIComponent(LOCATION.timezone)}`,
  );
}

export interface RadarResponse {
  radar: { timestamp: string; source: string; precipitation_5: number[][] }[];
  /** Corner coordinates [lon, lat] of the clipped grid: top-left, bottom-left, bottom-right, top-right. */
  geometry: { type: 'Polygon'; coordinates: [number, number][] };
  bbox: [number, number, number, number];
  latlon_position: { x: number; y: number };
}

export function fetchRadar(distanceMeters = 80000): Promise<RadarResponse> {
  return getJson(
    `${BRIGHT_SKY}/radar?lat=${LOCATION.lat}&lon=${LOCATION.lon}&distance=${distanceMeters}&format=plain`,
  );
}

// ---------- 15-minute model precipitation (ICON-D2) ----------

export interface Minutely15 {
  minutely_15: { time: string[]; precipitation: (number | null)[] };
}

/** ICON-D2 precipitation in 15-minute steps (mm per 15 min), local time keys. */
export function fetchMinutely15(lat: number, lon: number): Promise<Minutely15> {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: LOCATION.timezone,
    models: 'icon_d2',
    minutely_15: 'precipitation',
    past_minutely_15: '1',
    forecast_minutely_15: '16',
  });
  return getJson(`${OPEN_METEO}?${p}`);
}
