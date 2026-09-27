import { openMeteoApi } from "@/shared/api/openMeteoApi";
import type {
  Coordinates,
  CurrentWeather,
  DailyWeatherWithAstronomy,
  HourlyWeather,
} from "@/shared/types/weather";

/**
 * The readings the alert rules need, and nothing else.
 *
 * Its own endpoint rather than a reuse of `getBasicForecast` for one concrete
 * reason: **`uv_index_max` is not in that query**, so UV alerts could never
 * fire from it. A feature may not import another feature's query either, so
 * reaching into `features/forecast`'s widened forecast is not an option — this
 * is the boundary working as designed rather than a duplication.
 *
 * The variable list is deliberately narrow. `deriveAlerts` reads exactly six
 * series, and asking for more would make this the third full forecast on the
 * page for readings nothing renders.
 */

export interface AlertConditionsResponse {
  latitude: number;
  longitude: number;
  current?: CurrentWeather;
  hourly?: HourlyWeather;
  daily?: DailyWeatherWithAstronomy;
  timezone: string;
  utc_offset_seconds: number;
}

const alertEndpoints = openMeteoApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * `timezone: "auto"` so `daily.time[0]` is the local date at the
     * coordinate. That string becomes the alert id suffix, so getting it wrong
     * would give two viewers in different timezones different ids for the same
     * breach — and a dismissal that does not travel.
     */
    getAlertConditions: builder.query<AlertConditionsResponse, Coordinates>({
      query: ({ latitude, longitude }) => ({
        url: "forecast",
        params: {
          latitude,
          longitude,
          current: ["weather_code", "wind_speed_10m", "temperature_2m"].join(","),
          hourly: ["weather_code", "wind_speed_10m", "precipitation"].join(","),
          daily: [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "wind_speed_10m_max",
            "precipitation_sum",
            "uv_index_max",
          ].join(","),
          timezone: "auto",
          forecast_days: 2,
        },
      }),
      providesTags: ["Weather"],
    }),
  }),
});

export const { useGetAlertConditionsQuery } = alertEndpoints;
