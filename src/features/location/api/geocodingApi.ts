import { geocodingApi } from "@/shared/api/geocodingApi";
import type {
  GeocodingResponse,
  GeocodingResult,
} from "@/shared/types/weather";

/**
 * Forward geocoding — a place name in, WGS 84 coordinates out.
 *
 * Injected into the shared `geocodingApi`, which owns the host
 * `geocoding-api.open-meteo.com`. That is a **different host** from `api.`,
 * `marine-api.` and the rest; nothing here sets a `baseUrl`, because a copied
 * one produces a 404 that reads like a broken endpoint.
 *
 * This is the only direction Open-Meteo offers. The reverse — coordinate to
 * name — is Nominatim's and lives in `lib/geolocation.ts` beside this.
 */

const geocodingEndpoints = geocodingApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Search places by name.
     *
     * `transformResponse` exists for one reason: **a no-match response omits
     * `results` entirely** rather than sending an empty array. Normalising that
     * here means every consumer gets an array and nobody downstream has to
     * remember the quirk — and `data?.length === 0` becomes a reliable "no
     * results" signal instead of an `undefined` that also means "not fetched".
     */
    searchPlaces: builder.query<GeocodingResult[], string>({
      query: (name) => ({
        url: "search",
        params: { name, count: 10, language: "en", format: "json" },
      }),
      transformResponse: (response: GeocodingResponse) => response.results ?? [],
      providesTags: ["Places"],
    }),
  }),
});

export const { useSearchPlacesQuery } = geocodingEndpoints;
