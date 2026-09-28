import { useMemo } from "react";
import { useGetGeneralForecastQuery } from "@/features/forecast/api/forecastApi";
import { adviseGeneral } from "@/features/forecast/lib/advice";
import type { Coordinates } from "@/shared/types/weather";

/**
 * The forecast plus this persona's reading of it.
 *
 * Advice used to be attached in the API layer's `transformResponse`, which
 * meant every consumer of a forecast paid for it and the rules could only be
 * reached through the network. Applying it here keeps the transport shared and
 * the rules pure — and marine can use `getBasicForecast` with none of this.
 *
 * The query is this feature's own `getGeneralForecast`, not the shared
 * `getBasicForecast`: it additionally asks for `apparent_temperature` and the
 * daily astronomy block, which only this dashboard renders.
 */
export function useGeneralForecast(coordinates: Coordinates, days?: number) {
  const query = useGetGeneralForecastQuery({ ...coordinates, days });

  const advice = useMemo(
    () => (query.data ? adviseGeneral(query.data) : undefined),
    [query.data],
  );

  return { ...query, advice };
}
