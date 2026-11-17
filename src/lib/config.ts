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
