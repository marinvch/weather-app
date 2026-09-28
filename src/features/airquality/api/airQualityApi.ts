import { airQualityApi } from "@/shared/api/airQualityApi";
import type { AirQualityResponse, Coordinates } from "@/shared/types/weather";

/**
 * The air quality feature's own endpoint, injected into the shared transport.
 *
 * The base API in `@/shared/api/airQualityApi` owns the host —
 * `air-quality-api.open-meteo.com`, which is a **different host** from `api.`,
 * `marine-api.` and `archive-api.`. Nothing here sets a `baseUrl`; a copied one
 * is the usual cause of a 404 in this codebase, and it reads as a broken
 * endpoint rather than a wrong host.
 *
 * Interpretation is not here either. `lib/aqi.ts` turns these numbers into
 * bands and guidance, because the same AQI means different things to different
 * people and the transport layer has no business deciding which.
 */

/**
 * Current-conditions variables. Pollen is requested unconditionally even though
 * it is **Europe-only**: outside the CAMS European domain the API simply omits
 * the fields rather than erroring, so asking costs nothing and the caller
 * decides what an absent field means (`pollenReadings` returns empty, and the
 * panel hides the section).
 */
const CURRENT_VARIABLES = [
  "pm10",
  "pm2_5",
  "carbon_monoxide",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "european_aqi",
  "us_aqi",
  "uv_index",
  "uv_index_clear_sky",
  "alder_pollen",
  "birch_pollen",
  "grass_pollen",
  "mugwort_pollen",
  "olive_pollen",
  "ragweed_pollen",
] as const;

/** The same variables as an hourly series, for the day's UV and AQI curve. */
const HOURLY_VARIABLES = CURRENT_VARIABLES;

const airQualityEndpoints = airQualityApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Pollutants, AQI, UV and pollen for one coordinate.
     *
     * `timezone: "auto"` so the hourly timestamps are local to the coordinate.
     * Without it the series comes back in UTC and a "peak UV at 13:00" reading
     * is wrong by the offset — silently, because the strings still parse.
     */
    getAirQuality: builder.query<AirQualityResponse, Coordinates>({
      query: ({ latitude, longitude }) => ({
        url: "air-quality",
        params: {
          latitude,
          longitude,
          current: CURRENT_VARIABLES.join(","),
          hourly: HOURLY_VARIABLES.join(","),
          timezone: "auto",
        },
      }),
      providesTags: ["AirQuality", "Pollen"],
    }),
  }),
});

export const { useGetAirQualityQuery } = airQualityEndpoints;
