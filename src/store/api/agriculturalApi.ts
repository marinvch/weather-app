import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  AgriculturalResponse,
  Coordinates,
  AgriculturalAnalysis,
} from "../../types/weather";

// AI Analysis for Agricultural Data
const generateAgriculturalAnalysis = (
  agri: AgriculturalResponse
): AgriculturalAnalysis => {
  if (!agri.current) {
    return {
      recommendation: "Weather data unavailable",
      confidence: 0,
      reasoning: "No weather data",
      riskLevel: "medium",
      profileSpecificTips: [],
      soilConditions: "adequate",
      irrigationNeeded: false,
      frostRisk: "none",
      plantingConditions: "Unknown",
    };
  }

  const temp = agri.current.temperature_2m;
  const soilTemp = agri.current.soil_temperature_0cm;
  const soilMoisture = agri.current.soil_moisture_0_1cm;
  const humidity = agri.current.relative_humidity_2m;

  let soilConditions: "excellent" | "good" | "adequate" | "poor" = "good";
  let frostRisk: "none" | "light" | "moderate" | "severe" = "none";
  let irrigationNeeded = false;
  let riskLevel: "low" | "medium" | "high" = "low";
  const tips: string[] = [];

  // Soil analysis
  if (soilMoisture < 20) {
    soilConditions = "poor";
    irrigationNeeded = true;
    riskLevel = "medium";
    tips.push("Immediate irrigation recommended");
  } else if (soilMoisture > 80) {
    soilConditions = "adequate";
    riskLevel = "medium";
    tips.push("Risk of waterlogging - improve drainage");
  } else if (soilTemp > 15 && soilMoisture > 40 && soilMoisture < 70) {
    soilConditions = "excellent";
    tips.push("Optimal conditions for plant growth");
  }

  // Frost risk assessment
  if (temp < 2) {
    frostRisk = "severe";
    riskLevel = "high";
    tips.push("Protect sensitive crops immediately");
  } else if (temp < 5) {
    frostRisk = "moderate";
    riskLevel = "medium";
    tips.push("Monitor temperature closely");
  } else if (temp < 8 && humidity > 80) {
    frostRisk = "light";
    tips.push("Possible light frost - take precautions");
  }

  // Planting conditions analysis
  let plantingConditions = "Good";
  if (soilTemp < 10) {
    plantingConditions = "Too cold for most crops";
    tips.push("Wait for soil to warm up");
  } else if (soilTemp > 25 && soilMoisture < 30) {
    plantingConditions = "Too hot and dry";
    tips.push("Improve soil moisture before planting");
  } else if (frostRisk !== "none") {
    plantingConditions = "Risk of frost damage";
  } else if (soilConditions === "excellent") {
    plantingConditions = "Excellent for planting";
    tips.push("Ideal time for sowing");
  }

  // Harvest recommendations
  let harvestRecommendation = "";
  if (humidity < 60 && temp > 15 && temp < 25) {
    harvestRecommendation = "Good conditions for harvesting";
  } else if (humidity > 80) {
    harvestRecommendation = "High humidity - delay harvest if possible";
  }

  return {
    recommendation: `${soilConditions} soil conditions, ${frostRisk} frost risk`,
    confidence: 90,
    reasoning: `Soil: ${soilTemp}°C/${soilMoisture}%, Air: ${temp}°C, Humidity: ${humidity}%`,
    riskLevel,
    profileSpecificTips: tips,
    soilConditions,
    irrigationNeeded,
    frostRisk,
    plantingConditions,
    harvestRecommendation: harvestRecommendation || undefined,
  };
};

// Agricultural Weather API
export const agriculturalApi = createApi({
  reducerPath: "agriculturalApi",
  baseQuery: fetchBaseQuery({ baseUrl: "https://api.open-meteo.com/v1/" }),
  tagTypes: ["Agricultural"],
  endpoints: (builder) => ({
    // Agricultural weather data for farming and crop management with AI analysis
    getAgronomicData: builder.query<
      AgriculturalResponse & { aiAnalysis: AgriculturalAnalysis },
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
            "weather_code",
            "soil_temperature_0cm",
            "soil_moisture_0_1cm",
          ].join(","),
          hourly: [
            "temperature_2m",
            "precipitation_probability",
            "precipitation",
            "wind_speed_10m",
            "relative_humidity_2m",
            "weather_code",
            "soil_temperature_0cm",
            "soil_temperature_6cm",
            "soil_temperature_18cm",
            "soil_moisture_0_1cm",
            "soil_moisture_1_3cm",
            "soil_moisture_3_9cm",
            "et0_fao_evapotranspiration",
            "vapour_pressure_deficit",
            "surface_pressure",
          ].join(","),
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
            "weather_code",
            "et0_fao_evapotranspiration",
            "sunrise",
            "sunset",
          ].join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      transformResponse: (response: AgriculturalResponse) => ({
        ...response,
        aiAnalysis: generateAgriculturalAnalysis(response),
      }),
      providesTags: ["Agricultural"],
    }),

    // Get frost risk data for agricultural planning with analysis
    getFrostRisk: builder.query<
      AgriculturalResponse & { aiAnalysis: AgriculturalAnalysis },
      Coordinates & { days?: number }
    >({
      query: ({ latitude, longitude, days = 14 }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          current: [
            "temperature_2m",
            "relative_humidity_2m",
            "soil_temperature_0cm",
            "soil_moisture_0_1cm",
          ].join(","),
          hourly: [
            "temperature_2m",
            "soil_temperature_0cm",
            "soil_temperature_6cm",
            "relative_humidity_2m",
            "dew_point_2m",
          ].join(","),
          daily: ["temperature_2m_min", "temperature_2m_max"].join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      transformResponse: (response: AgriculturalResponse) => ({
        ...response,
        aiAnalysis: generateAgriculturalAnalysis(response),
      }),
      providesTags: ["Agricultural"],
    }),

    // Get soil and evapotranspiration data with analysis
    getSoilData: builder.query<
      AgriculturalResponse & { aiAnalysis: AgriculturalAnalysis },
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
            "soil_temperature_0cm",
            "soil_moisture_0_1cm",
          ].join(","),
          hourly: [
            "soil_temperature_0cm",
            "soil_temperature_6cm",
            "soil_temperature_18cm",
            "soil_temperature_54cm",
            "soil_moisture_0_1cm",
            "soil_moisture_1_3cm",
            "soil_moisture_3_9cm",
            "soil_moisture_9_27cm",
            "soil_moisture_27_81cm",
            "et0_fao_evapotranspiration",
          ].join(","),
          daily: ["et0_fao_evapotranspiration"].join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      transformResponse: (response: AgriculturalResponse) => ({
        ...response,
        aiAnalysis: generateAgriculturalAnalysis(response),
      }),
      providesTags: ["Agricultural"],
    }),
  }),
});

export const {
  useGetAgronomicDataQuery,
  useGetFrostRiskQuery,
  useGetSoilDataQuery,
} = agriculturalApi;
