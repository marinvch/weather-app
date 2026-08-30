import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { Coordinates, HistoricalResponse } from "@/shared/types/weather";

/**
 * Base API for `archive-api.open-meteo.com` — the third distinct Open-Meteo
 * host, serving historical series.
 *
 * No feature consumes this yet: the tabbed dashboard that used it was removed
 * as dead code. It is kept because historical comparison is a natural next
 * feature for every persona, and because it documents the third host.
 */
export const archiveApi = createApi({
  reducerPath: "archive",
  baseQuery: fetchBaseQuery({
    baseUrl: "https://archive-api.open-meteo.com/v1/",
  }),
  tagTypes: ["Historical"],
  endpoints: (builder) => ({
    getHistoricalData: builder.query<
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
            "temperature_2m_mean",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
          ].join(","),
          timezone: "auto",
        },
      }),
      providesTags: ["Historical"],
    }),
  }),
});

export const { useGetHistoricalDataQuery } = archiveApi;
