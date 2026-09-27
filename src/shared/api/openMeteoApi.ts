import { createApi } from "@reduxjs/toolkit/query/react";
import { createBaseQuery } from "./baseQuery";
import type { Coordinates, WeatherResponse } from "@/shared/types/weather";

/**
 * The base API for `api.open-meteo.com` — transport only.
 *
 * Features add their own endpoints with `injectEndpoints`, so a persona's
 * queries live in that persona's folder while sharing one cache, one reducer
 * and one middleware entry. Adding a feature must not mean touching the store.
 *
 * Two other hosts exist and each needs its own base API, because `baseUrl` is
 * fixed per `createApi`: marine (`marineBaseApi`) and archive (`archiveApi`).
 *
 * Nothing here attaches advice. Advice is per-persona and lives in that
 * feature's `lib/advice.ts` — putting it here would make `shared` depend on the
 * features, which is the one direction the architecture forbids.
 */
export const openMeteoApi = createApi({
  reducerPath: "openMeteo",
  baseQuery: createBaseQuery("https://api.open-meteo.com/v1/"),
  tagTypes: ["Weather", "Soil", "Historical"],
  endpoints: (builder) => ({
    /**
     * A plain forecast for a coordinate. Shared rather than owned by
     * `features/forecast`, because marine needs the same raw numbers to show
     * air conditions alongside sea state — and a feature may not import from
     * another feature.
     */
    getBasicForecast: builder.query<
      WeatherResponse,
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
      providesTags: ["Weather"],
    }),
  }),
});

export const { useGetBasicForecastQuery } = openMeteoApi;
