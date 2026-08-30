import { openMeteoApi } from "@/shared/api/openMeteoApi";
import type {
  AgriculturalResponse,
  Coordinates,
} from "@/shared/types/weather";

/**
 * Soil and crop queries. Same host as the general forecast, so they inject into
 * the same base API — the persona difference is in the parameters and the
 * advice, not the transport.
 */
export const agricultureApi = openMeteoApi.injectEndpoints({
  endpoints: (builder) => ({
    getAgronomicData: builder.query<
      AgriculturalResponse,
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
      providesTags: ["Soil"],
    }),

    // 14 days by default, not 7 — a frost warning is only useful with enough
    // lead time to act on it.
    getFrostRisk: builder.query<
      AgriculturalResponse,
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
      providesTags: ["Soil"],
    }),

    getSoilData: builder.query<
      AgriculturalResponse,
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
      providesTags: ["Soil"],
    }),
  }),
});

export const {
  useGetAgronomicDataQuery,
  useGetFrostRiskQuery,
  useGetSoilDataQuery,
} = agricultureApi;
