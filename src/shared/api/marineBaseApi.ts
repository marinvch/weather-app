import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * Base API for `marine-api.open-meteo.com` — a different host from the forecast
 * API, which is the usual cause of a 404 when an endpoint is copied between
 * them. `baseUrl` is fixed per createApi, so a second host needs a second API.
 *
 * Endpoints are injected by `features/marine`.
 */
export const marineBaseApi = createApi({
  reducerPath: "marine",
  baseQuery: fetchBaseQuery({
    baseUrl: "https://marine-api.open-meteo.com/v1/",
  }),
  tagTypes: ["Marine"],
  endpoints: () => ({}),
});
