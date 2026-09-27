import { createApi } from "@reduxjs/toolkit/query/react";
import { createBaseQuery } from "./baseQuery";

/**
 * Base API for `geocoding-api.open-meteo.com` — transport only.
 *
 * A **fifth distinct Open-Meteo host**. `baseUrl` is fixed per `createApi`, so
 * this cannot be folded into `openMeteoApi`; copying an endpoint across two of
 * them gives a 404, not a type error.
 *
 * This is the *forward* direction only — a place name in, WGS 84 coordinates
 * out. The reverse (coordinate to name) is Nominatim's, and lives in
 * `features/location`; Open-Meteo does not offer it.
 *
 * Coordinates come back as WGS 84 decimal degrees ordered `latitude,
 * longitude`, like every other source this app talks to, so nothing converts
 * them. They do arrive from outside, so the feature that admits a result into
 * the store normalizes it with `@/shared/lib/geo` at that boundary.
 *
 * **Registering this in `@/store/store` needs BOTH `geocodingApi.reducerPath`
 * in the reducer map AND `geocodingApi.middleware` in the `.concat()` chain.**
 * Omitting the middleware raises no error — the query simply never fires.
 */
export const geocodingApi = createApi({
  reducerPath: "geocoding",
  baseQuery: createBaseQuery("https://geocoding-api.open-meteo.com/v1/"),
  tagTypes: ["Places"],
  endpoints: () => ({}),
});
