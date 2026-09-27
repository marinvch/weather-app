import { useMemo } from "react";
import { useGetMountainForecastQuery } from "@/features/mountain/api/mountainApi";
import { adviseMountain } from "@/features/mountain/lib/advice";
import type { Coordinates } from "@/shared/types/weather";

/**
 * Mountain forecast plus avalanche/exposure advice.
 *
 * `elevation` is left undefined by default on purpose — see the note in
 * `../api/mountainApi`. Passing it asks Open-Meteo to correct the forecast to
 * that altitude; omitting it asks for the real terrain height, which is the
 * thing this persona wants to read.
 */
export function useMountainForecast(
  coordinates: Coordinates,
  options?: { elevation?: number; days?: number },
) {
  const query = useGetMountainForecastQuery({ ...coordinates, ...options });

  const advice = useMemo(
    () => (query.data ? adviseMountain(query.data) : undefined),
    [query.data],
  );

  return { ...query, advice };
}
