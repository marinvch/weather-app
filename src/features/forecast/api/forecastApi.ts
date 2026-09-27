import { openMeteoApi } from "@/shared/api/openMeteoApi";
import type {
  Coordinates,
  CurrentWeather,
  DailyWeatherWithAstronomy,
  HourlyWeather,
  WeatherResponse,
} from "@/shared/types/weather";

/**
 * The general dashboard's own forecast query, injected into the shared
 * `api.open-meteo.com` transport.
 *
 * Separate from `getBasicForecast` rather than a change to it. That query is
 * shared — marine reads it for air conditions beside the sea state — so
 * widening it would make every persona pay for astronomy and apparent
 * temperature they do not render. This asks for more, in the feature that wants
 * more.
 */

/**
 * `apparent_temperature` is additive over the canonical `CurrentWeather`, not a
 * redeclaration of it: the shape still comes from `@/shared/types/weather` and
 * only the one field this query adds is declared here.
 *
 * Optional because Open-Meteo returns only the variables that were requested,
 * and a cached response from before this field was asked for will not have it.
 */
export type CurrentWeatherWithApparent = CurrentWeather & {
  /** **Celsius.** Wind chill and humidity folded into the dry-bulb reading. */
  apparent_temperature?: number;
};

export type HourlyWeatherWithApparent = HourlyWeather & {
  apparent_temperature?: number[];
};

/** `WeatherResponse` with the three blocks this query widens. */
export interface GeneralForecastResponse
  extends Omit<WeatherResponse, "current" | "hourly" | "daily"> {
  current?: CurrentWeatherWithApparent;
  hourly?: HourlyWeatherWithApparent;
  daily?: DailyWeatherWithAstronomy;
}

const CURRENT_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "weather_code",
  "is_day",
  "precipitation",
  "cloud_cover",
] as const;

const HOURLY_VARIABLES = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "weather_code",
  "precipitation",
  "precipitation_probability",
  "cloud_cover",
] as const;

/**
 * `daylight_duration` and `sunshine_duration` come back in **seconds**, not
 * hours — 50400, not 14. Rendering one straight into a "hours of daylight"
 * figure is the shape of mistake this block invites.
 */
const DAILY_VARIABLES = [
  "temperature_2m_max",
  "temperature_2m_min",
  "weather_code",
  "precipitation_sum",
  "wind_speed_10m_max",
  "sunrise",
  "sunset",
  "daylight_duration",
  "sunshine_duration",
  "uv_index_max",
] as const;

const forecastEndpoints = openMeteoApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * The general-public forecast: current conditions, an hourly series and a
     * daily series with astronomy.
     *
     * `timezone: "auto"` is what makes `sunrise`/`sunset` the wall-clock times
     * at the coordinate. Without it they arrive in UTC and a sunrise in Tokyo
     * reads as the previous evening — silently, because the strings still parse.
     */
    getGeneralForecast: builder.query<
      GeneralForecastResponse,
      Coordinates & { days?: number }
    >({
      query: ({ latitude, longitude, days = 7 }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          current: CURRENT_VARIABLES.join(","),
          hourly: HOURLY_VARIABLES.join(","),
          daily: DAILY_VARIABLES.join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      providesTags: ["Weather"],
    }),
  }),
});

export const { useGetGeneralForecastQuery } = forecastEndpoints;
