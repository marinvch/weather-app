import { marineBaseApi } from "@/shared/api/marineBaseApi";
import type { Coordinates, MarineResponse } from "@/shared/types/weather";

/**
 * Sea-state queries, injected into the marine host's base API.
 *
 * Open-Meteo returns an empty series rather than an error for an inland
 * coordinate, so "no waves" and "not the sea" look alike downstream — the
 * dashboard's empty state exists for exactly that case.
 */
export const marineApi = marineBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMarineData: builder.query<
      MarineResponse,
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
      providesTags: ["Marine"],
    }),

    getCurrentMarineConditions: builder.query<MarineResponse, Coordinates>({
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
      providesTags: ["Marine"],
    }),
  }),
});

export const { useGetMarineDataQuery, useGetCurrentMarineConditionsQuery } =
  marineApi;
