import { openMeteoApi } from "@/shared/api/openMeteoApi";
import type {
  Coordinates,
  CurrentWeather,
  DailyWeather,
  WeatherResponse,
} from "@/shared/types/weather";

/**
 * The hourly block this feature asks for.
 *
 * Every series is optional because Open-Meteo returns only the variables it has
 * for the coordinate: `wind_speed_80m` and `wind_speed_120m` are absent over
 * some terrain, and `freezing_level_height` is absent where the model has no
 * profile. `HourlyWeather` is assignable to this, so anything already holding a
 * plain hourly payload still fits.
 */
export interface MountainHourly {
  time: string[];
  temperature_2m?: number[];
  apparent_temperature?: number[];
  wind_speed_10m?: number[];
  wind_speed_80m?: number[];
  wind_speed_120m?: number[];
  wind_direction_10m?: number[];
  weather_code?: number[];
  cloud_cover?: number[];
  relative_humidity_2m?: number[];
  precipitation?: number[];
  /** **Metres**, not centimetres. See `snowDepthReading` in ../lib/conditions. */
  snow_depth?: number[];
  /** Metres above sea level of the 0 °C isotherm. */
  freezing_level_height?: number[];
}

export interface MountainDaily extends DailyWeather {
  snowfall_sum?: number[];
}

/**
 * The forecast, plus the two things the persona is actually about.
 *
 * `elevation` is the model's terrain height for the coordinate, in metres above
 * sea level — the whole point of an altitude-aware view, and something the
 * generic `WeatherResponse` does not carry. Declared here rather than in
 * `@/shared/types/weather` because only this feature reads it; if a second
 * persona ever needs it, it should move rather than be copied.
 */
export interface MountainForecastResponse
  extends Omit<WeatherResponse, "current" | "hourly" | "daily"> {
  /** Metres above sea level, from the model's terrain. */
  elevation?: number;
  current?: CurrentWeather & { apparent_temperature?: number };
  hourly?: MountainHourly;
  daily?: MountainDaily;
}

/**
 * Mountain-specific queries, owned by this feature but injected into the shared
 * `api.open-meteo.com` base so they share one cache and one middleware entry.
 *
 * The store never learns this exists — that is the point of injectEndpoints.
 * Importing this module is what registers the endpoints, so a component must
 * import the hook from here rather than reaching for the base API.
 *
 * ## Why `elevation` is no longer sent by default
 *
 * Open-Meteo treats the `elevation` parameter as an instruction: it downscales
 * the temperature to the height you name and echoes that height back as the
 * response's `elevation`. This query used to send a fixed 1000 m for every
 * coordinate, so the sea-level user and the 3000 m user were both shown a
 * forecast corrected to 1000 m, and the response's own elevation field was
 * simply the number we had sent.
 *
 * Omitted, the API uses its 90 m digital elevation model for the coordinate —
 * the real terrain height — and returns it. Temperatures now reflect where the
 * point actually is, and `elevation` becomes a reading rather than an echo. The
 * parameter is still accepted for a caller that genuinely wants a specific
 * altitude, and is then correctly understood as a question, not a location.
 */
export const mountainApi = openMeteoApi.injectEndpoints({
  endpoints: (builder) => ({
    getMountainForecast: builder.query<
      MountainForecastResponse,
      Coordinates & { elevation?: number; days?: number }
    >({
      query: ({ latitude, longitude, elevation, days = 7 }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          // Only sent when a caller explicitly asks for a corrected altitude.
          ...(elevation !== undefined ? { elevation } : {}),
          current: [
            "temperature_2m",
            "apparent_temperature",
            "wind_speed_10m",
            // The 80 m and 120 m winds are the whole reason this is a separate
            // query — ridge exposure is not visible in the 10 m figure.
            "wind_speed_80m",
            "wind_speed_120m",
            "wind_direction_10m",
            "weather_code",
            "cloud_cover",
            "relative_humidity_2m",
            "is_day",
          ].join(","),
          hourly: [
            "temperature_2m",
            "apparent_temperature",
            "wind_speed_10m",
            "wind_speed_80m",
            "wind_speed_120m",
            "wind_direction_10m",
            "weather_code",
            "cloud_cover",
            "relative_humidity_2m",
            "precipitation",
            "snow_depth",
            "freezing_level_height",
          ].join(","),
          daily: [
            "temperature_2m_max",
            "temperature_2m_min",
            "weather_code",
            "precipitation_sum",
            "snowfall_sum",
            "wind_speed_10m_max",
            "sunrise",
            "sunset",
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
