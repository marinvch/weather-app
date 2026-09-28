import { useMemo } from "react";
import { useGetMarineFieldQuery } from "@/features/marine/api/marineApi";
import { useGetBasicForecastQuery } from "@/shared/api/openMeteoApi";
import {
  buildMarineDirectionFields,
  windDirectionField,
} from "@/features/marine/lib/directionField";
import type { DirectionFieldSpec } from "@/shared/lib/arrowField";
import type { Coordinates } from "@/shared/types/weather";

/**
 * The arrow fields for `WeatherMap`, owned by the feature that owns the query.
 *
 * `src/app` composes this into the app-level map — the dependency runs
 * `shared → features → app`, so the composition root may call this and this may
 * not reach back into it. The map itself fetches nothing.
 *
 * Wind comes from the ordinary forecast host and the sea from the marine host,
 * because those are two different hosts and only one of them knows about wind.
 *
 * Returns an empty array inland, where every marine cell answers with nulls —
 * so the map simply offers no arrow layers rather than a toggle that draws
 * nothing.
 */
export function useMarineDirectionFields(
  coordinates: Coordinates,
): DirectionFieldSpec[] {
  const field = useGetMarineFieldQuery(coordinates);
  const forecast = useGetBasicForecastQuery(coordinates);

  const air = forecast.data?.current;
  const cells = field.data;

  return useMemo(() => {
    const wind = windDirectionField(coordinates, air);
    // Wind first: it is the field a mariner reaches for, and the map offers
    // them in the order given.
    return [...(wind ? [wind] : []), ...buildMarineDirectionFields(cells)];
  }, [cells, air, coordinates]);
}
