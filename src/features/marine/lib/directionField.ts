/**
 * Building the map's arrow fields from marine data.
 *
 * `@/shared/ui/WeatherMap` draws a `DirectionFieldSpec` and fetches nothing —
 * that is the boundary. The feature that owns the query owns the field, which
 * means this file owns the one decision the map cannot make for itself:
 * **which end of the flow each Open-Meteo field reports.**
 *
 * ## Open-Meteo disagrees with itself, and getting it wrong is invisible
 *
 * | Field | Reports | `convention` |
 * |---|---|---|
 * | `wind_direction_10m` | the direction the wind blows **FROM** | `"from"` |
 * | `wave_direction`, `swell_wave_direction` | the direction the waves travel **TOWARDS** | `"towards"` |
 * | `ocean_current_direction` | the direction the current **sets** — towards | `"towards"` |
 *
 * Wind is named for where it comes from (a southerly blows *from* the south);
 * waves and currents are named for where they are going. Arrows always render
 * downstream, so a wrong `convention` is off by exactly 180° — and it still
 * looks like a coherent field, just one pointing at the wrong coast. There is
 * no default for it anywhere in the pipeline for that reason, and there is a
 * test below for each field asserting its convention by name.
 *
 * ## Scale
 *
 * Every field passes an explicit `scaleMax`. Without one the ramp rescales to
 * whatever the largest reading in *this* hour happens to be, so a flat calm
 * renders identically to a gale and the colour stops meaning anything over
 * time. The values are fixed constants below, chosen so an ordinary day sits in
 * the lower half of the ramp.
 */

import type {
  DirectionFieldSpec,
  DirectionSample,
} from "@/shared/lib/arrowField";
import { isRenderableSample } from "@/shared/lib/arrowField";
import { degreesToCardinal } from "@/shared/lib/units";
import type { CurrentWeather, MarineResponse } from "@/shared/types/weather";
import { at, currentHourIndex } from "@/features/marine/lib/readings";

/**
 * Ramp ceilings, in the units the readings arrive in.
 *
 * Wind: 40 km/h is a strong breeze at the top of the ramp, so a workable day
 * stays in the lower bins. Waves and swell: 4 m is Douglas 6, "very rough",
 * where small craft should not be out. Current: 3 km/h is a strong tidal set.
 */
export const WIND_SCALE_MAX_KMH = 40;
export const WAVE_SCALE_MAX_M = 4;
export const CURRENT_SCALE_MAX_KMH = 3;

/** Which reading a field is built from. Also its `id` on the map. */
export type MarineFieldId = "wind" | "waves" | "swell" | "current";

interface FieldRecipe {
  id: MarineFieldId;
  name: string;
  unit: string;
  /** **Never defaulted.** See the table at the top of this file. */
  convention: "from" | "towards";
  scaleMax: number;
  direction: (hourly: MarineResponse["hourly"], hour: number) => number | null;
  magnitude: (hourly: MarineResponse["hourly"], hour: number) => number | null;
}

/**
 * The three fields the marine host can answer for. Wind is not among them: the
 * marine host reports no wind at all, so it is built separately from the
 * ordinary forecast — see `windDirectionField`.
 */
const MARINE_RECIPES: readonly FieldRecipe[] = [
  {
    id: "waves",
    name: "Waves",
    unit: "m",
    // Waves travel towards the reported bearing.
    convention: "towards",
    scaleMax: WAVE_SCALE_MAX_M,
    direction: (h, i) => at(h?.wave_direction, i),
    magnitude: (h, i) => at(h?.wave_height, i),
  },
  {
    id: "swell",
    name: "Swell",
    unit: "m",
    convention: "towards",
    scaleMax: WAVE_SCALE_MAX_M,
    direction: (h, i) => at(h?.swell_wave_direction, i),
    magnitude: (h, i) => at(h?.swell_wave_height, i),
  },
  {
    id: "current",
    name: "Surface current",
    unit: "km/h",
    // Oceanographic convention: a current is named for where it sets, which is
    // where it is going — the opposite of how a wind is named.
    convention: "towards",
    scaleMax: CURRENT_SCALE_MAX_KMH,
    direction: (h, i) => at(h?.ocean_current_direction, i),
    magnitude: (h, i) => at(h?.ocean_current_velocity, i),
  },
] as const;

export interface BuildFieldsOptions {
  /** Injectable clock, for picking the hour out of each cell's series. */
  now?: Date;
}

/**
 * Turn a grid of marine responses into the map's arrow fields.
 *
 * Each cell is plotted at **its own returned coordinate**, not the one that was
 * requested: the model snaps to its ~1/12° cells, so asking for 42.4 answers
 * 42.458336, and drawing the arrow at the request would put every reading
 * slightly off its own water.
 *
 * Cells the model has nothing for are dropped rather than drawn at zero — an
 * inland cell in a coastal grid answers 200 with a null series, and a field of
 * zero-length arrows over farmland is a claim that the sea there is flat. A
 * field with no renderable samples left is omitted entirely, so the map offers
 * no toggle for a layer that would draw nothing.
 */
export function buildMarineDirectionFields(
  cells: readonly MarineResponse[] | undefined,
  options: BuildFieldsOptions = {},
): DirectionFieldSpec[] {
  if (!cells || cells.length === 0) return [];

  return MARINE_RECIPES.flatMap((recipe) => {
    const samples: DirectionSample[] = [];

    for (const cell of cells) {
      const hourly = cell?.hourly;
      if (!hourly?.time?.length) continue;

      const hour = currentHourIndex(hourly.time.length, options.now);
      const directionDegrees = recipe.direction(hourly, hour);
      const magnitude = recipe.magnitude(hourly, hour);

      if (directionDegrees == null || magnitude == null) continue;

      const sample: DirectionSample = {
        latitude: cell.latitude,
        longitude: cell.longitude,
        directionDegrees,
        magnitude,
        label: `${recipe.name} ${magnitude.toFixed(1)} ${recipe.unit}, running ${degreesToCardinal(directionDegrees)}`,
      };

      if (isRenderableSample(sample)) samples.push(sample);
    }

    if (samples.length === 0) return [];

    return [
      {
        id: recipe.id,
        name: recipe.name,
        unit: recipe.unit,
        convention: recipe.convention,
        scaleMax: recipe.scaleMax,
        samples,
      },
    ];
  });
}

/**
 * The wind field, from the ordinary forecast host.
 *
 * Separate because the marine host reports no wind, and a single point rather
 * than a grid because that is what the basic forecast query returns — one
 * honest arrow at the location beats nine copies of the same reading spread
 * across a grid to look like a field.
 *
 * `convention: "from"` — the one field in this file that is not "towards".
 * `wind_direction_10m` names where the wind comes from, so the arrow renders
 * 180° round from the reading.
 */
export function windDirectionField(
  coordinates: { latitude: number; longitude: number },
  current: CurrentWeather | undefined,
): DirectionFieldSpec | null {
  if (!current) return null;

  const sample: DirectionSample = {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    directionDegrees: current.wind_direction_10m,
    magnitude: current.wind_speed_10m,
    label: `Wind ${Math.round(current.wind_speed_10m)} km/h from the ${degreesToCardinal(current.wind_direction_10m)}`,
  };

  if (!isRenderableSample(sample)) return null;

  return {
    id: "wind",
    name: "Wind",
    unit: "km/h",
    convention: "from",
    scaleMax: WIND_SCALE_MAX_KMH,
    samples: [sample],
  };
}
