// Weather data types
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
