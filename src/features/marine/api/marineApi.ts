import { marineBaseApi } from "@/shared/api/marineBaseApi";
import type { Coordinates, MarineResponse } from "@/shared/types/weather";

/**
 * Sea-state queries, injected into the marine host's base API.
 *
 * Open-Meteo returns an empty series rather than an error for an inland
 * coordinate, so "no waves" and "not the sea" look alike downstream — the
 * dashboard's empty state exists for exactly that case.
 */
export const marineApi = marineBaseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMarineData: builder.query<
      MarineResponse,
      Coordinates & { days?: number }
    >({
      query: ({ latitude, longitude, days = 7 }) => ({
        url: "marine",
        params: {
          latitude,
          longitude,
          hourly: [
            "wave_height",
            "wave_direction",
            "wave_period",
            "wind_wave_height",
            "wind_wave_direction",
            "wind_wave_period",
            "swell_wave_height",
            "swell_wave_direction",
            "swell_wave_period",
            "ocean_current_velocity",
            "ocean_current_direction",
            "sea_surface_temperature",
          ].join(","),
          daily: [
            "wave_height_max",
            "wave_direction_dominant",
            "wave_period_max",
            "wind_wave_height_max",
            "wind_wave_direction_dominant",
            "wind_wave_period_max",
            "swell_wave_height_max",
            "swell_wave_direction_dominant",
            "swell_wave_period_max",
          ].join(","),
          timezone: "auto",
          forecast_days: days,
        },
      }),
      providesTags: ["Marine"],
    }),

    getCurrentMarineConditions: builder.query<MarineResponse, Coordinates>({
      query: ({ latitude, longitude }) => ({
        url: "marine",
        params: {
          latitude,
          longitude,
          hourly: [
            "wave_height",
            "wave_direction",
            "wave_period",
            "wind_wave_height",
            "wind_wave_direction",
            "swell_wave_height",
            "swell_wave_direction",
            "ocean_current_velocity",
            "ocean_current_direction",
            "sea_surface_temperature",
          ].join(","),
          timezone: "auto",
          forecast_hours: 1,
        },
      }),
      providesTags: ["Marine"],
    }),

    /**
     * A grid of marine readings around a point, for the map's arrow field.
     *
     * **Open-Meteo takes comma-separated coordinates and answers with a JSON
     * array**, one entry per point, in the order asked — which is why the
     * result type here is `MarineResponse[]` and not `MarineResponse`. One
     * request covers the whole grid; nine separate requests would be nine
     * chances to be rate-limited halfway through and draw half a field.
     *
     * Each entry carries its **own** `latitude`/`longitude`, and they are not
     * the ones sent: the model snaps to its own ~1/12° cells, so asking for
     * 42.4 answers 42.458336. The arrow belongs at the cell the reading
     * describes, so `buildDirectionFields` plots the returned coordinate and
     * never the requested one.
     *
     * Points outside the model's coverage come back as a full series of nulls
     * rather than being omitted, so the array length always matches the request
     * and inland cells are filtered when the samples are built.
     */
    getMarineField: builder.query<
      MarineResponse[],
      Coordinates & { spacingDegrees?: number; steps?: number }
    >({
      query: ({ latitude, longitude, spacingDegrees = 0.15, steps = 2 }) => {
        const grid = gridAround(
          { latitude, longitude },
          spacingDegrees,
          steps,
        );
        return {
          url: "marine",
          params: {
            latitude: grid.map((p) => p.latitude).join(","),
            longitude: grid.map((p) => p.longitude).join(","),
            hourly: [
              "wave_height",
              "wave_direction",
              "swell_wave_height",
              "swell_wave_direction",
              "ocean_current_velocity",
              "ocean_current_direction",
            ].join(","),
            timezone: "auto",
            forecast_days: 1,
          },
        };
      },
      providesTags: ["Marine"],
    }),
  }),
});

/**
 * A square grid of coordinates centred on a point, `steps` cells out in each
 * direction — so `steps: 2` is 5×5 = 25 points.
 *
 * Latitude is clamped to the poles and longitude wrapped across the
 * antimeridian, because a grid near either edge otherwise asks for coordinates
 * that are not on Earth. **No projection and no conversion**: these are WGS 84
 * decimal degrees in, WGS 84 decimal degrees out, which is the only coordinate
 * system this app has. Degrees of longitude narrow towards the poles, so the
 * grid is square in degrees rather than in kilometres — that is a sampling
 * pattern, not a measurement, and nothing downstream reads a distance from it.
 */
function gridAround(
  centre: Coordinates,
  spacingDegrees: number,
  steps: number,
): Coordinates[] {
  const points: Coordinates[] = [];

  for (let row = -steps; row <= steps; row += 1) {
    for (let column = -steps; column <= steps; column += 1) {
      const latitude = Math.min(
        90,
        Math.max(-90, centre.latitude + row * spacingDegrees),
      );
      // Wrap into [-180, 180) rather than clamping: longitude is cyclic, and a
      // clamp would pile every cell east of 180° onto the same meridian.
      const raw = centre.longitude + column * spacingDegrees;
      const longitude = ((((raw + 180) % 360) + 360) % 360) - 180;

      points.push({ latitude, longitude });
    }
  }

  return points;
}

export const {
  useGetMarineDataQuery,
  useGetCurrentMarineConditionsQuery,
  useGetMarineFieldQuery,
} = marineApi;
