import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { HistoricalResponse, Coordinates } from "../../types/weather";

// Historical Weather API
export const historicalApi = createApi({
  reducerPath: "historicalApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "https://archive-api.open-meteo.com/v1/",
  }),
  tagTypes: ["Historical"],
  endpoints: (builder) => ({
    // Historical weather data for analysis and trends
    getHistoricalData: builder.query<
      HistoricalResponse,
      Coordinates & { start_date: string; end_date: string }
    >({
      query: ({ latitude, longitude, start_date, end_date }) => ({
        url: "archive",
        params: {
          latitude,
          longitude,
          start_date,
          end_date,
          daily: [
            "temperature_2m_mean",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
            "weather_code_max",
          ].join(","),
          timezone: "auto",
        },
      }),
      providesTags: ["Historical"],
    }),

    // Get same period from previous years for comparison
    getHistoricalComparison: builder.query<
      HistoricalResponse[],
      Coordinates & { month: number; day: number; years_back: number }
    >({
      query: ({ latitude, longitude, month, day, years_back }) => {
        // Generate multiple queries for different years
        const currentYear = new Date().getFullYear();
        const promises = [];

        for (let i = 1; i <= years_back; i++) {
          const year = currentYear - i;
          const start_date = `${year}-${month.toString().padStart(2, "0")}-${day
            .toString()
            .padStart(2, "0")}`;
          const end_date = start_date; // Same day

          promises.push({
            url: "archive",
            params: {
              latitude,
              longitude,
              start_date,
              end_date,
              daily: [
                "temperature_2m_mean",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "wind_speed_10m_max",
              ].join(","),
              timezone: "auto",
            },
          });
        }

        return promises[0]; // For now, return first year only
      },
      providesTags: ["Historical"],
    }),
  }),
});

export const { useGetHistoricalDataQuery, useGetHistoricalComparisonQuery } =
  historicalApi;
