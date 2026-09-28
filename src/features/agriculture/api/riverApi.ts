import { floodApi } from "@/shared/api/floodApi";
import type { Coordinates, FloodResponse } from "@/shared/types/weather";

/**
 * River discharge, injected into the flood host's base API.
 *
 * **A fourth Open-Meteo host** — `flood-api.open-meteo.com`, not `api.`,
 * `marine-api.` or `archive-api.`. `baseUrl` is fixed per `createApi`, which is
 * why this injects into `floodApi` rather than into `openMeteoApi`; a copied
 * base URL here answers 404 and reads like a bad endpoint rather than a bad
 * host.
 *
 * Owned by `agriculture` because it is the only persona that reads it: a grower
 * with riverside ground wants to know whether the river is coming up. Keyless,
 * like everything else here.
 *
 * ⚠️ **`floodApi` must be registered in `@/store/store` with BOTH
 * `floodApi.reducerPath` in the reducer map and `floodApi.middleware` in the
 * `.concat()` chain.** Omitting the middleware raises no error at all — the
 * query simply never fires, and the dashboard sits in its honest "no modelled
 * river here" state forever, which looks exactly like a coordinate with no
 * river.
 */
export const riverApi = floodApi.injectEndpoints({
  endpoints: (builder) => ({
    getRiverDischarge: builder.query<
      FloodResponse,
      Coordinates & { days?: number }
    >({
      query: ({ latitude, longitude, days = 7 }) => ({
        url: "flood",
        params: {
          latitude,
          longitude,
          daily: "river_discharge",
          timezone: "auto",
          forecast_days: days,
        },
      }),
      providesTags: ["Flood"],
    }),
  }),
});

export const { useGetRiverDischargeQuery } = riverApi;
