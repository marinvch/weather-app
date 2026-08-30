import { openMeteoApi } from "@/shared/api/openMeteoApi";
import type { Coordinates, WeatherResponse } from "@/shared/types/weather";

/**
 * Mountain-specific queries, owned by this feature but injected into the shared
 * `api.open-meteo.com` base so they share one cache and one middleware entry.
 *
 * The store never learns this exists — that is the point of injectEndpoints.
 * Importing this module is what registers the endpoints, so a component must
 * import the hook from here rather than reaching for the base API.
 */
export const mountainApi = openMeteoApi.injectEndpoints({
  endpoints: (builder) => ({
    getMountainForecast: builder.query<
      WeatherResponse,
      Coordinates & { elevation?: number; days?: number }
    >({
      query: ({ latitude, longitude, elevation = 1000, days = 7 }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          // Open-Meteo corrects temperature for this elevation. 1000 m is a
          // neutral default, not a measurement of where the user is.
          elevation,
          current: [
            "temperature_2m",
            "wind_speed_10m",
            // The 80 m and 120 m winds are the whole reason this is a separate
            // query — ridge exposure is not visible in the 10 m figure.
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
      providesTags: ["Weather"],
    }),
  }),
});

export const { useGetMountainForecastQuery } = mountainApi;
