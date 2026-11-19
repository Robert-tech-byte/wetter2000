export const LOCATION = {
  name: 'München',
  lat: 48.137,
  lon: 11.575,
  timezone: 'Europe/Berlin',
};

/** Temperature tolerance (°C) for "models agree". */
export const TEMP_TOLERANCE = 1.5;
/** Hourly precipitation (mm) from which a model counts as "rain". */
export const RAIN_THRESHOLD = 0.1;
/** A model is used for a day only if it covers at least this share of the day's hours. */
export const MIN_COVERAGE = 0.75;
/** Number of days (today included) for the agreement analysis. */
export const AGREEMENT_DAYS = 3;
/** Length of the main forecast in days (ECMWF IFS). */
export const FORECAST_DAYS = 15;

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  resolutionKm: number;
}

/**
 * Deterministic models with a grid spacing of at most 7 km whose domain covers Munich.
 * Resolutions as stated by the providers / Open-Meteo (approximate).
 */
export const HIRES_MODELS: ModelInfo[] = [
  { id: 'icon_d2', name: 'ICON-D2', provider: 'DWD', resolutionKm: 2.2 },
  { id: 'icon_eu', name: 'ICON-EU', provider: 'DWD', resolutionKm: 7 },
  { id: 'meteoswiss_icon_ch1', name: 'ICON-CH1', provider: 'MeteoSchweiz', resolutionKm: 1 },
  { id: 'meteoswiss_icon_ch2', name: 'ICON-CH2', provider: 'MeteoSchweiz', resolutionKm: 2 },
  { id: 'meteofrance_arome_france_hd', name: 'AROME HD', provider: 'Météo-France', resolutionKm: 1.5 },
  { id: 'knmi_harmonie_arome_europe', name: 'HARMONIE Europa', provider: 'KNMI', resolutionKm: 5.5 },
  { id: 'dmi_harmonie_arome_europe', name: 'HARMONIE DINI', provider: 'DMI', resolutionKm: 2 },
];

export const EPS_MODEL = {
  id: 'icon_d2',
  name: 'ICON-D2-EPS',
  provider: 'DWD',
  resolutionKm: 2.2,
  members: 20,
};

/** Föhn rule of thumb (all must hold in at least FOEHN_MIN_HOURS daytime hours). */
export const FOEHN = {
  bozen: { lat: 46.498, lon: 11.354 },
  /** Pressure Bozen minus München (hPa). */
  minPressureDiff: 4,
  /** Relative humidity in München below (%). */
  maxHumidity: 55,
  /** Wind direction at ~3000 m (700 hPa) from S to SW (degrees). */
  dirFrom: 135,
  dirTo: 250,
  minHours: 2,
  /** Local hours considered (inclusive start, exclusive end). */
  hours: [6, 22] as const,
};

/**
 * Beyond ICON-D2-EPS (2 days): ICON-EU-EPS for the agreement and the ensemble details,
 * as far as it reaches (about 5 days).
 */
export const EU_EPS_MODEL = {
  id: 'icon_eu',
  name: 'ICON-EU-EPS',
  provider: 'DWD',
  resolutionKm: 6.5,
  members: 40,
  fetchDays: 6,
};

/** After ICON-EU-EPS: ECMWF's AI model AIFS compared with the ECMWF main run (IFS). */
export const AIFS_MODEL = {
  id: 'ecmwf_aifs025_single',
  name: 'ECMWF AIFS',
  provider: 'ECMWF',
  resolutionKm: 28,
};
