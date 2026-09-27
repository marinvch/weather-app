import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * Base API for `air-quality-api.open-meteo.com` — transport only.
 *
 * A **fourth distinct Open-Meteo host**, alongside `api.` (`openMeteoApi`),
 * `marine-api.` (`marineBaseApi`) and `archive-api.` (`archiveApi`). `baseUrl`
 * is fixed per `createApi`, so each host needs its own instance, and copying an
 * endpoint between two of them produces a 404 rather than a type error.
 *
 * Note the host name is hyphenated — `air-quality-api`, not `airquality-api`.
 *
 * Features attach their queries with `injectEndpoints`, so a persona's queries
 * live in that persona's folder while sharing one cache, one reducer and one
 * middleware entry. Nothing here derives advice: an AQI of 60 is a shrug to a
 * mariner and a stay-indoors to someone with asthma, so the interpretation
 * belongs to the feature.
 *
 * **Registering this in `@/store/store` needs BOTH `airQualityApi.reducerPath`
 * in the reducer map AND `airQualityApi.middleware` in the `.concat()` chain.**
 * Omitting the middleware raises no error at any point — the query simply never
 * fires and the hook stays `isLoading` forever.
 */
export const airQualityApi = createApi({
  reducerPath: "airQuality",
  baseQuery: fetchBaseQuery({
    baseUrl: "https://air-quality-api.open-meteo.com/v1/",
  }),
  tagTypes: ["AirQuality", "Pollen"],
  endpoints: () => ({}),
});
