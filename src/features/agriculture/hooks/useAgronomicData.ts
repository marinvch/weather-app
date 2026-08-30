import { useMemo } from "react";
import { useGetAgronomicDataQuery } from "@/features/agriculture/api/agricultureApi";
import { adviseAgriculture } from "@/features/agriculture/lib/advice";
import type { Coordinates } from "@/shared/types/weather";

/** Soil and crop data plus irrigation/frost/planting advice. */
export function useAgronomicData(coordinates: Coordinates, days?: number) {
  const query = useGetAgronomicDataQuery({ ...coordinates, days });

  const advice = useMemo(
    () => (query.data ? adviseAgriculture(query.data) : undefined),
    [query.data],
  );

  return { ...query, advice };
}
