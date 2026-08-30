import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  WeatherResponse,
  HistoricalResponse,
  Coordinates,
  AIAnalysis,
  MountainAnalysis,
} from '@/shared/types/weather';

// AI Analysis Functions
export const generateGeneralAnalysis = (weather: WeatherResponse): AIAnalysis => {
  if (!weather.current) {
    return {
      recommendation: "Weather data unavailable",
      confidence: 0,
      reasoning: "No current weather data",
      riskLevel: "medium",
      profileSpecificTips: [],
    };
  }

  const temp = weather.current.temperature_2m;
  const wind = weather.current.wind_speed_10m;
  const weatherCode = weather.current.weather_code;

  let recommendation = "";
  let riskLevel: "low" | "medium" | "high" = "low";
  const tips: string[] = [];

  // Temperature analysis
  if (temp > 25) {
    recommendation = "Perfect weather for outdoor activities! ";
    tips.push("Stay hydrated and use sun protection");
  } else if (temp < 5) {
    recommendation = "Cold weather - dress warmly. ";
    riskLevel = "medium";
    tips.push("Layer clothing and protect extremities");
  } else {
    recommendation = "Comfortable weather conditions. ";
  }

  // Wind analysis
  if (wind > 20) {
    recommendation += "Strong winds present.";
    riskLevel = "medium";
    tips.push("Secure loose objects and be cautious outdoors");
  }

  // Weather code analysis
  if (weatherCode >= 61 && weatherCode <= 65) {
    recommendation += " Rain expected - carry an umbrella.";
    tips.push("Wear waterproof clothing");
  } else if (weatherCode >= 71 && weatherCode <= 75) {
    recommendation += " Snow conditions - exercise caution.";
    riskLevel = "high";
    tips.push("Use appropriate footwear for slippery conditions");
  }

  return {
    recommendation,
    confidence: 85,
    reasoning: `Based on temperature ${temp}°C, wind speed ${wind} km/h, and weather conditions`,
    riskLevel,
    profileSpecificTips: tips,
  };
};

export const generateMountainAnalysis = (
  weather: WeatherResponse
): MountainAnalysis => {
  if (!weather.current) {
    return {
      recommendation: "Weather data unavailable",
      confidence: 0,
      reasoning: "No weather data",
      riskLevel: "medium",
      profileSpecificTips: [],
      avalancheRisk: "low",
      visibilityForecast: "Unknown",
      windExposure: "Unknown",
      temperatureGradient: "Unknown",
    };
  }

  const temp = weather.current.temperature_2m;
  const windSpeed = weather.current.wind_speed_10m;
  const weatherCode = weather.current.weather_code;

  let avalancheRisk: "low" | "moderate" | "considerable" | "high" | "extreme" =
    "low";
  let riskLevel: "low" | "medium" | "high" = "low";
  let windExposure = "Mild";

  // Mountain-specific risk assessment
  if (temp > 0 && temp < 3) {
    // Temperature near freezing - higher avalanche risk
    avalancheRisk = "moderate";
    riskLevel = "medium";
  }

  if (windSpeed > 40) {
    windExposure = "Extreme";
    riskLevel = "high";
  } else if (windSpeed > 25) {
    windExposure = "High";
    riskLevel = "medium";
  } else if (windSpeed > 15) {
    windExposure = "Moderate";
  }

  // Weather conditions affecting visibility
  if (weatherCode > 70) {
    // Snow/storms
    avalancheRisk = "high";
    riskLevel = "high";
  }

  return {
    recommendation: `${avalancheRisk} avalanche risk, ${windExposure.toLowerCase()} wind exposure`,
    confidence: 82,
    reasoning: `Temperature: ${temp}°C, wind: ${windSpeed}km/h, weather code: ${weatherCode}`,
    riskLevel,
    profileSpecificTips: [
      avalancheRisk === "high"
        ? "Avoid steep slopes and wind-loaded areas"
        : "Check local avalanche bulletins",
      windSpeed > 30
        ? "Strong winds - protect exposed skin"
        : "Moderate wind conditions",
      temp < -10
        ? "Extreme cold - risk of frostbite"
        : "Dress appropriately for temperature",
    ],
    avalancheRisk,
    visibilityForecast: weatherCode <= 3 ? "Good" : "Limited due to weather",
    windExposure,
    temperatureGradient: `Surface: ${temp}°C, potential -6°C per 1000m elevation`,
  };
};

// Base API configuration
export const weatherApi = createApi({
  reducerPath: "weatherApi",
  baseQuery: fetchBaseQuery({ baseUrl: "https://api.open-meteo.com/v1/" }),
  tagTypes: ["Weather", "Historical", "Analysis"],
  endpoints: (builder) => ({
    // General weather forecast with AI analysis
    getBasicForecast: builder.query<
      WeatherResponse & { aiAnalysis: AIAnalysis },
      Coordinates & { days?: number }
    >({
      query: ({ latitude, longitude, days = 7 }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          current: [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code",
            "is_day",
            "precipitation",
            "cloud_cover",
          ].join(","),
          hourly: [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code",
            "precipitation",
            "cloud_cover",
            "precipitation_probability",
          ].join(","),
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "weather_code",
            "precipitation_sum",
            "wind_speed_10m_max",
            "wind_direction_10m_dominant",
          ].join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      transformResponse: (
        response: WeatherResponse
      ): WeatherResponse & { aiAnalysis: AIAnalysis } => ({
        ...response,
        aiAnalysis: generateGeneralAnalysis(response),
      }),
      providesTags: ["Weather"],
    }),

    // Mountain weather with specialized analysis
    getMountainForecast: builder.query<
      WeatherResponse & { aiAnalysis: MountainAnalysis },
      Coordinates & { elevation?: number; days?: number }
    >({
      query: ({ latitude, longitude, elevation = 1000, days = 7 }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          elevation,
          current: [
            "temperature_2m",
            "wind_speed_10m",
            "wind_speed_80m",
            "wind_speed_120m",
            "wind_direction_10m",
            "weather_code",
            "cloud_cover",
            "relative_humidity_2m",
          ].join(","),
          hourly: [
            "temperature_2m",
            "wind_speed_10m",
            "wind_speed_80m",
            "wind_speed_120m",
            "weather_code",
            "cloud_cover",
            "relative_humidity_2m",
            "precipitation",
            "snow_depth",
          ].join(","),
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "weather_code",
            "precipitation_sum",
            "snowfall_sum",
            "wind_speed_10m_max",
          ].join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      transformResponse: (
        response: WeatherResponse
      ): WeatherResponse & { aiAnalysis: MountainAnalysis } => ({
        ...response,
        aiAnalysis: generateMountainAnalysis(response),
      }),
      providesTags: ["Weather", "Analysis"],
    }),

    // Historical weather data
    getHistoricalWeather: builder.query<
      HistoricalResponse,
      Coordinates & { startDate: string; endDate: string }
    >({
      query: ({ latitude, longitude, startDate, endDate }) => ({
        url: "archive",
        params: {
          latitude,
          longitude,
          start_date: startDate,
          end_date: endDate,
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
            "weather_code",
          ].join(","),
          timezone: "auto",
        },
      }),
      providesTags: ["Historical"],
    }),

    // Long-range forecast (up to 16 days)
    getLongRangeForecast: builder.query<
      WeatherResponse & { aiAnalysis: AIAnalysis },
      Coordinates
    >({
      query: ({ latitude, longitude }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "weather_code",
            "precipitation_sum",
            "wind_speed_10m_max",
            "precipitation_probability_max",
          ].join(","),
          timezone: "auto",
          forecast_days: 16,
        },
      }),
      transformResponse: (
        response: WeatherResponse
      ): WeatherResponse & { aiAnalysis: AIAnalysis } => ({
        ...response,
        aiAnalysis: generateGeneralAnalysis(response),
      }),
      providesTags: ["Weather"],
    }),
  }),
});

export const {
  useGetBasicForecastQuery,
  useGetMountainForecastQuery,
  useGetHistoricalWeatherQuery,
  useGetLongRangeForecastQuery,
} = weatherApi;
