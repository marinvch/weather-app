// Weather data types

/**
 * A point on Earth, in **WGS 84 decimal degrees** (EPSG:4326) — the app's one
 * coordinate reference system, everywhere, with no conversions.
 *
 * Latitude ∈ [-90, 90], longitude ∈ [-180, 180], always in that axis order.
 * See `@/shared/lib/geo` for the constant, the validators and the formatter;
 * anything that builds a pair from outside the app normalizes it there first.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  weather_code: number;
  is_day: number;
  precipitation?: number;
  cloud_cover?: number;
  wind_speed_80m?: number;
  wind_speed_120m?: number;
}

export interface HourlyWeather {
  time: string[];
  temperature_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  relative_humidity_2m: number[];
  weather_code: number[];
  cloud_cover?: number[];
}

export interface DailyWeather {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  weather_code: number[];
  sunrise: string[];
  sunset: string[];
}

export interface WeatherResponse {
  latitude: number;
  longitude: number;
  current?: CurrentWeather;
  hourly?: HourlyWeather;
  daily?: DailyWeather;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
}

// Marine weather types
export interface MarineWeather {
  wave_height: number[];
  wave_direction: number[];
  wave_period: number[];
  wind_wave_height: number[];
  wind_wave_direction: number[];
  wind_wave_period: number[];
  swell_wave_height: number[];
  swell_wave_direction: number[];
  swell_wave_period: number[];
  ocean_current_velocity: number[];
  ocean_current_direction: number[];
  sea_surface_temperature: number[];
}

export interface MarineResponse {
  latitude: number;
  longitude: number;
  hourly: MarineWeather & { time: string[] };
  timezone: string;
}

// Historical weather types
export interface HistoricalWeather {
  time: string[];
  temperature_2m_mean: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
}

export interface HistoricalResponse {
  latitude: number;
  longitude: number;
  daily: HistoricalWeather;
  timezone: string;
}

// Agricultural weather types
export interface AgriculturalWeather extends HourlyWeather {
  soil_temperature_0cm: number[];
  soil_temperature_6cm: number[];
  soil_temperature_18cm: number[];
  soil_moisture_0_1cm: number[];
  soil_moisture_1_3cm: number[];
  soil_moisture_3_9cm: number[];
  et0_fao_evapotranspiration: number[];
}

export interface AgriculturalResponse {
  latitude: number;
  longitude: number;
  current: CurrentWeather & {
    soil_temperature_0cm: number;
    soil_moisture_0_1cm: number;
  };
  hourly: AgriculturalWeather;
  daily: DailyWeather & {
    et0_fao_evapotranspiration: number[];
  };
  timezone: string;
}

// User profile types
export type UserProfile = "general" | "marine" | "mountain" | "agriculture";

export interface UserPreferences {
  profile: UserProfile;
  units: "metric" | "imperial";
  language: string;
  timezone: string;
  location: Coordinates | null;
  locationName: string;
}

// Alert types
export interface WeatherAlert {
  id: string;
  type: "info" | "warning" | "danger";
  profile: UserProfile;
  title: string;
  message: string;
  timestamp: string;
  conditions: Record<string, unknown>;
  aiAnalysis?: AIAnalysis;
}

// AI Analysis types
export interface AIAnalysis {
  recommendation: string;
  confidence: number; // 0-100
  reasoning: string;
  bestTimeForActivity?: string;
  riskLevel: "low" | "medium" | "high";
  profileSpecificTips: string[];
}

// Enhanced analysis for different profiles
export interface MarineAnalysis extends AIAnalysis {
  fishingConditions: "excellent" | "good" | "fair" | "poor";
  seaState: string;
  tideRecommendation?: string;
  waveAnalysis: string;
}

export interface MountainAnalysis extends AIAnalysis {
  avalancheRisk: "low" | "moderate" | "considerable" | "high" | "extreme";
  visibilityForecast: string;
  windExposure: string;
  temperatureGradient: string;
}

export interface AgriculturalAnalysis extends AIAnalysis {
  soilConditions: "excellent" | "good" | "adequate" | "poor";
  irrigationNeeded: boolean;
  frostRisk: "none" | "light" | "moderate" | "severe";
  plantingConditions: string;
  harvestRecommendation?: string;
}

// Historical trend analysis
export interface HistoricalTrend {
  period: string;
  averageTemperature: number;
  temperatureTrend: "rising" | "falling" | "stable";
  precipitationTrend: "increasing" | "decreasing" | "stable";
  comparisonToNormal: "above" | "below" | "normal";
  significantEvents: string[];
}

// Weather map data
export interface WeatherMapLayer {
  type: "temperature" | "precipitation" | "wind" | "pressure" | "clouds";
  url: string;
  opacity: number;
  timestamp: string;
}

// Weather condition codes mapping
export const weatherCodes: Record<
  number,
  { description: string; icon: string }
> = {
  0: { description: "Clear sky", icon: "☀️" },
  1: { description: "Mainly clear", icon: "🌤️" },
  2: { description: "Partly cloudy", icon: "⛅" },
  3: { description: "Overcast", icon: "☁️" },
  45: { description: "Fog", icon: "🌫️" },
  48: { description: "Depositing rime fog", icon: "🌫️" },
  51: { description: "Light drizzle", icon: "🌦️" },
  53: { description: "Moderate drizzle", icon: "🌦️" },
  55: { description: "Dense drizzle", icon: "🌦️" },
  61: { description: "Slight rain", icon: "🌧️" },
  63: { description: "Moderate rain", icon: "🌧️" },
  65: { description: "Heavy rain", icon: "🌧️" },
  71: { description: "Slight snow fall", icon: "🌨️" },
  73: { description: "Moderate snow fall", icon: "❄️" },
  75: { description: "Heavy snow fall", icon: "❄️" },
  77: { description: "Snow grains", icon: "❄️" },
  80: { description: "Slight rain showers", icon: "🌦️" },
  81: { description: "Moderate rain showers", icon: "🌦️" },
  82: { description: "Violent rain showers", icon: "⛈️" },
  85: { description: "Slight snow showers", icon: "🌨️" },
  86: { description: "Heavy snow showers", icon: "❄️" },
  95: { description: "Thunderstorm", icon: "⛈️" },
  96: { description: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { description: "Thunderstorm with heavy hail", icon: "⛈️" },
};

// ---------------------------------------------------------------------------
// Risk severity
// ---------------------------------------------------------------------------

/**
 * The four-step severity scale the shared **UI** communicates with — `RiskGauge`,
 * `MetricTile`'s `severity` and the `risk` palette section in
 * `@/shared/theme/theme`, where step *n* of `severity: 0|1|2|3` is the *n*th
 * member of this union.
 *
 * ## `"medium"` next to `"moderate"` is not a typo. Do not "fix" it.
 *
 * This app holds **nine** different severity-ish string unions, and they are
 * deliberately separate types. This one is for display. `AIAnalysis.riskLevel`
 * below is the three-step `"low" | "medium" | "high"` that the four
 * `features/*\/lib/advice.ts` scorers emit, and it **stays** three-step — the
 * decision was to convert at the display boundary with `riskLevelFromAnalysis`
 * rather than migrate the root type. That function is the only sanctioned
 * crossing. A cast is not.
 *
 * Three of the other unions cannot be mapped onto this one at all, and a
 * "consolidation" that widens them is a bug, not a cleanup:
 *
 * - `MountainAnalysis.avalancheRisk` is the five-step European Avalanche Danger
 *   Scale. **`"considerable"` (EADS level 3) has no equivalent here**, and
 *   collapsing it into "moderate" or "high" is wrong in both directions —
 *   that is an avalanche-safety statement, not a styling detail.
 * - `AgriculturalAnalysis.frostRisk` is `"none" | "light" | "moderate" |
 *   "severe"`. It shares two words with this union, which is exactly what makes
 *   it look assignable. `"none"` is a real zero state and `"light"` is not
 *   `"moderate"`; aligning the four positionally shifts every reading up a band.
 * - The marine sea-state reading carries a `"no data"` member (`"unknown"` in
 *   the version of `features/marine/lib` this note was written against). That
 *   is the inland-coordinate case, not a severity: the marine host answers an
 *   inland point with a series of nulls rather than an error. It belongs in
 *   `DashboardShell`'s `isEmpty`, and mapping it to `"low"` claims a calm sea
 *   where there is none.
 *
 * And `MarineAnalysis.fishingConditions` / `AgriculturalAnalysis.soilConditions`
 * run **good to bad**, the opposite direction to `RISK_LEVELS`. Never map either
 * of them by array index: `"excellent"` would land on `"low"` only by accident
 * of ordering, and `"poor"` would come out as low risk.
 */
export type RiskLevel = "low" | "moderate" | "high" | "severe";

/** The ordered scale, so a severity index and a `RiskLevel` agree everywhere. */
export const RISK_LEVELS: readonly RiskLevel[] = [
  "low",
  "moderate",
  "high",
  "severe",
] as const;

/**
 * Widen an Analysis's three-step `riskLevel` onto the four-step display scale.
 *
 * "medium" becomes "moderate" — the same band under the name the palette uses.
 * Nothing produces "severe" from an Analysis today; it exists for the alert and
 * flood surfaces, which do have a fourth band.
 *
 * **This is a load-bearing boundary, not a convenience.** It is the one
 * sanctioned crossing between the scorers' scale and the palette's, chosen over
 * migrating `AIAnalysis.riskLevel` itself. Every call site that hands an
 * Analysis to `RiskGauge` or `MetricTile` goes through here; a cast instead
 * yields `"medium"`, which matches no key in the `risk` palette and renders
 * `undefined` colours rather than failing.
 */
export function riskLevelFromAnalysis(
  level: AIAnalysis["riskLevel"],
): RiskLevel {
  return level === "medium" ? "moderate" : level;
}

// ---------------------------------------------------------------------------
// Air quality — `air-quality-api.open-meteo.com` (see @/shared/api/airQualityApi)
// ---------------------------------------------------------------------------

/**
 * Pollutant concentrations are µg/m³ except `carbon_monoxide`, which Open-Meteo
 * also reports in µg/m³ (not the ppm most national indices quote). The two AQI
 * fields are index values, not concentrations, and use different scales:
 * `european_aqi` runs 0–100+, `us_aqi` 0–500.
 *
 * Every field is optional. The air quality API answers with only the variables
 * that were asked for, and drops any it has no data for at that coordinate —
 * pollen in particular is Europe-only.
 */
export interface AirQualityCurrent {
  time: string;
  interval?: number;
  pm10?: number;
  pm2_5?: number;
  carbon_monoxide?: number;
  nitrogen_dioxide?: number;
  sulphur_dioxide?: number;
  ozone?: number;
  european_aqi?: number;
  us_aqi?: number;
  uv_index?: number;
  uv_index_clear_sky?: number;
  alder_pollen?: number;
  birch_pollen?: number;
  grass_pollen?: number;
  mugwort_pollen?: number;
  olive_pollen?: number;
  ragweed_pollen?: number;
}

export interface AirQualityHourly {
  time: string[];
  pm10?: number[];
  pm2_5?: number[];
  carbon_monoxide?: number[];
  nitrogen_dioxide?: number[];
  sulphur_dioxide?: number[];
  ozone?: number[];
  european_aqi?: number[];
  us_aqi?: number[];
  uv_index?: number[];
  uv_index_clear_sky?: number[];
  alder_pollen?: number[];
  birch_pollen?: number[];
  grass_pollen?: number[];
  mugwort_pollen?: number[];
  olive_pollen?: number[];
  ragweed_pollen?: number[];
}

export interface AirQualityResponse {
  latitude: number;
  longitude: number;
  current?: AirQualityCurrent;
  hourly?: AirQualityHourly;
  timezone: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
}

// ---------------------------------------------------------------------------
// Forward geocoding — `geocoding-api.open-meteo.com` (see @/shared/api/geocodingApi)
// ---------------------------------------------------------------------------

/**
 * A place returned by a name search. `latitude` / `longitude` are WGS 84
 * decimal degrees like everything else in this app, so a result can be handed
 * straight to a forecast query — but it arrives from outside, so normalize it
 * with `@/shared/lib/geo` at the boundary that admits it.
 *
 * Distinct from the *reverse* direction (coordinate to name), which is
 * Nominatim's job and lives in `features/location`. Open-Meteo's geocoder only
 * goes name to coordinate.
 */
export interface GeocodingResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  /** First-level division — a state, province or oblast. */
  admin1?: string;
  /** Second-level division — a county or district. */
  admin2?: string;
  timezone?: string;
  population?: number;
  /** Metres above mean sea level. */
  elevation?: number;
}

export interface GeocodingResponse {
  /** Absent, not empty, when nothing matched — the field is omitted entirely. */
  results?: GeocodingResult[];
  generationtime_ms?: number;
}

// ---------------------------------------------------------------------------
// River discharge — `flood-api.open-meteo.com` (see @/shared/api/floodApi)
// ---------------------------------------------------------------------------

/**
 * Discharge is m³/s through the GloFAS river cell nearest the coordinate. A
 * coordinate with no modelled river nearby answers with nulls rather than an
 * error, which is why the series are nullable.
 */
export interface FloodDaily {
  time: string[];
  river_discharge?: (number | null)[];
  river_discharge_mean?: (number | null)[];
  river_discharge_max?: (number | null)[];
}

export interface FloodResponse {
  latitude: number;
  longitude: number;
  daily: FloodDaily;
  timezone?: string;
}

// ---------------------------------------------------------------------------
// Astronomy
// ---------------------------------------------------------------------------

/**
 * The daily astronomy block, additive over `DailyWeather` so an existing
 * consumer of a plain daily payload keeps compiling.
 *
 * Durations are **seconds**, not hours: `daylight_duration` is sunrise-to-sunset
 * and `sunshine_duration` is the part of it above the "sunny" irradiance
 * threshold, so sunshine ≤ daylight always. Every field is optional because
 * Open-Meteo returns only the `daily=` variables that were requested.
 */
export interface DailyAstronomy {
  sunrise?: string[];
  sunset?: string[];
  daylight_duration?: number[];
  sunshine_duration?: number[];
  uv_index_max?: number[];
}

/** `DailyWeather` plus the astronomy block, for the forecast surfaces. */
export type DailyWeatherWithAstronomy = DailyWeather & DailyAstronomy;
