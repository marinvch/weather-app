import { useMemo } from "react";
import { useGetMarineDataQuery } from "@/features/marine/api/marineApi";
import { adviseMarine, type AdviseMarineOptions } from "@/features/marine/lib/advice";
import { hasMarineData } from "@/features/marine/lib/readings";
import type { Coordinates } from "@/shared/types/weather";

export interface UseMarineConditionsOptions
  extends Pick<AdviseMarineOptions, "windSpeedKmh" | "windDirectionDegrees"> {
  days?: number;
}

/**
 * Sea state plus the advice derived from it.
 *
 * Wind comes in as an argument rather than being fetched here: the marine host
 * does not report it, so it belongs to the forecast query the dashboard already
 * has. Passing it in keeps this hook to one request and keeps `adviseMarine`
 * pure.
 *
 * `hasData` is the answer to "is this coordinate at sea". A 200 response with a
 * full series of nulls is what an inland point gets, so `data` being present is
 * not the same question — see `lib/readings`.
 */
export function useMarineConditions(
  coordinates: Coordinates,
  options: UseMarineConditionsOptions = {},
) {
  const { days, windSpeedKmh = null, windDirectionDegrees = null } = options;

  const query = useGetMarineDataQuery({ ...coordinates, days });

  const advice = useMemo(
    () =>
      query.data
        ? adviseMarine(query.data, { windSpeedKmh, windDirectionDegrees })
        : undefined,
    [query.data, windSpeedKmh, windDirectionDegrees],
  );

  const hasData = useMemo(() => hasMarineData(query.data), [query.data]);

  return { ...query, advice, hasData };
}
