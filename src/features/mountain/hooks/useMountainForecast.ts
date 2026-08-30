import { useMemo } from "react";
import { useGetMountainForecastQuery } from "@/features/mountain/api/mountainApi";
import { adviseMountain } from "@/features/mountain/lib/advice";
import type { Coordinates } from "@/shared/types/weather";

/** Mountain forecast plus avalanche/exposure advice. */
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
