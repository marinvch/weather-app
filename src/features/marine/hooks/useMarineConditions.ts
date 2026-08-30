import { useMemo } from "react";
import { useGetMarineDataQuery } from "@/features/marine/api/marineApi";
import { adviseMarine } from "@/features/marine/lib/advice";
import type { Coordinates } from "@/shared/types/weather";

/** Sea state plus fishing/sailing advice. */
export function useMarineConditions(coordinates: Coordinates, days?: number) {
  const query = useGetMarineDataQuery({ ...coordinates, days });

  const advice = useMemo(
    () => (query.data ? adviseMarine(query.data) : undefined),
    [query.data],
  );

  return { ...query, advice };
}
