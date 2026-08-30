import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  MarineResponse,
  Coordinates,
  MarineAnalysis,
} from '@/shared/types/weather';

// AI Analysis for Marine Data
const generateMarineAnalysis = (marine: MarineResponse): MarineAnalysis => {
  const waveHeight = marine.hourly.wave_height[0] || 0;
  const windWaveHeight = marine.hourly.wind_wave_height[0] || 0;
  const seaTemp = marine.hourly.sea_surface_temperature[0] || 15;
  const currentVelocity = marine.hourly.ocean_current_velocity[0] || 0;

  let fishingConditions: "excellent" | "good" | "fair" | "poor" = "good";
  let riskLevel: "low" | "medium" | "high" = "low";
  const tips: string[] = [];

  // Wave analysis
  if (waveHeight > 3) {
    fishingConditions = "poor";
    riskLevel = "high";
    tips.push("Dangerous conditions - consider postponing trip");
  } else if (waveHeight > 2) {
    fishingConditions = "fair";
    riskLevel = "medium";
    tips.push("Moderate seas - experienced mariners only");
  } else if (waveHeight < 0.5 && seaTemp > 18) {
    fishingConditions = "excellent";
    tips.push("Ideal conditions for fishing");
  } else {
    tips.push("Good conditions for most marine activities");
  }

  // Sea temperature analysis
  if (seaTemp > 22) {
    tips.push("Warm water - excellent for swimming and water sports");
  } else if (seaTemp < 12) {
    tips.push("Cold water - use appropriate thermal protection");
  }

  // Current analysis
  if (currentVelocity > 1.5) {
    tips.push("Strong currents present - adjust navigation accordingly");
    if (riskLevel === "low") riskLevel = "medium";
  }

  // Best time analysis
  let bestTime = "All day suitable";
  if (waveHeight > 1.5) {
    bestTime = "Early morning typically calmer";
  }

  return {
    recommendation: `${fishingConditions} fishing conditions with ${waveHeight}m waves`,
    confidence: 92,
    reasoning: `Wave height: ${waveHeight}m, Sea temp: ${seaTemp}°C, Current: ${currentVelocity}m/s`,
    riskLevel,
    profileSpecificTips: tips,
    bestTimeForActivity: bestTime,
    fishingConditions,
    seaState:
      waveHeight > 2.5
        ? "Rough"
        : waveHeight > 1.5
        ? "Moderate"
        : waveHeight > 0.5
        ? "Slight"
        : "Calm",
    waveAnalysis: `Significant wave height: ${waveHeight}m, Wind waves: ${windWaveHeight}m`,
    tideRecommendation:
      currentVelocity > 1
        ? "Strong tidal flow - plan accordingly"
        : "Moderate tidal conditions",
  };
};

// Marine Weather API
export const marineApi = createApi({
  reducerPath: "marineApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "https://marine-api.open-meteo.com/v1/",
  }),
  tagTypes: ["Marine"],
  endpoints: (builder) => ({
    // Marine weather data for fishermen and mariners with AI analysis
    getMarineData: builder.query<
      MarineResponse & { aiAnalysis: MarineAnalysis },
      Coordinates & { days?: number }
    >({
      query: ({ latitude, longitude, days = 7 }) => ({
        url: "marine",
        params: {
          latitude,
          longitude,
          hourly: [
            "wave_height",
            "wave_direction",
            "wave_period",
            "wind_wave_height",
            "wind_wave_direction",
            "wind_wave_period",
            "swell_wave_height",
            "swell_wave_direction",
            "swell_wave_period",
            "ocean_current_velocity",
            "ocean_current_direction",
            "sea_surface_temperature",
          ].join(","),
          daily: [
            "wave_height_max",
            "wave_direction_dominant",
            "wave_period_max",
            "wind_wave_height_max",
            "wind_wave_direction_dominant",
            "wind_wave_period_max",
            "swell_wave_height_max",
            "swell_wave_direction_dominant",
            "swell_wave_period_max",
          ].join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      transformResponse: (response: MarineResponse) => ({
        ...response,
        aiAnalysis: generateMarineAnalysis(response),
      }),
      providesTags: ["Marine"],
    }),

    // Get current marine conditions with analysis
    getCurrentMarineConditions: builder.query<
      MarineResponse & { aiAnalysis: MarineAnalysis },
      Coordinates
    >({
      query: ({ latitude, longitude }) => ({
        url: "marine",
        params: {
          latitude,
          longitude,
          hourly: [
            "wave_height",
            "wave_direction",
            "wave_period",
            "wind_wave_height",
            "wind_wave_direction",
            "swell_wave_height",
            "swell_wave_direction",
            "ocean_current_velocity",
            "ocean_current_direction",
            "sea_surface_temperature",
          ].join(","),
          timezone: "auto",
          forecast_hours: 1,
        },
      }),
      transformResponse: (response: MarineResponse) => ({
        ...response,
        aiAnalysis: generateMarineAnalysis(response),
      }),
      providesTags: ["Marine"],
    }),
  }),
});

export const { useGetMarineDataQuery, useGetCurrentMarineConditionsQuery } =
  marineApi;
