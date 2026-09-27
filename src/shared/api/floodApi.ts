import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * Base API for `flood-api.open-meteo.com` — transport only.
 *
 * A **sixth distinct Open-Meteo host**. `baseUrl` is fixed per `createApi`, so
 * it needs its own instance; a `baseUrl` copied from another host is the usual
 * cause of a 404 here, and it looks like a bad endpoint rather than a bad host.
 *
 * Serves GloFAS river discharge (m³/s) for the modelled river cell nearest a
 * coordinate. Two things follow from "nearest cell": a coordinate far from any
 * modelled river answers **200 with nulls**, not an error — so a present
 * response is never proof of usable data, and the caller checks the series —
 * and the figure describes a river, not the sky, so it says nothing about
 * rainfall at the point asked for.
 *
 * **Registering this in `@/store/store` needs BOTH `floodApi.reducerPath` in
 * the reducer map AND `floodApi.middleware` in the `.concat()` chain.**
 * Omitting the middleware raises no error — the query simply never fires.
 */
export const floodApi = createApi({
  reducerPath: "flood",
  baseQuery: fetchBaseQuery({
    baseUrl: "https://flood-api.open-meteo.com/v1/",
  }),
  tagTypes: ["Flood"],
  endpoints: () => ({}),
});
