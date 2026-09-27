/**
 * Reading the marine payload honestly.
 *
 * `MarineResponse` in `@/shared/types/weather` types every hourly series as
 * `number[]`, which is what the marine host returns **at sea**. Inland it
 * returns the same series filled with `null` and HTTP 200 — the field is
 * present, the array is the right length, and every element is null. TypeScript
 * therefore promises a `number` where there is nothing, and `(0).toFixed(1)`
 * renders "0.0 m" of wave on a farm in Bavaria.
 *
 * So nothing in this feature indexes a marine series directly. Everything goes
 * through `at`, which narrows to `number | null`, and the dashboard asks
 * `hasMarineData` before it renders a single tile.
 */

import type { MarineResponse } from "@/shared/types/weather";

/**
 * One element of an hourly series, as `number | null`.
 *
 * The parameter is typed loosely because the caller hands it a `number[]` that
 * the compiler believes and the network does not. Narrowing happens here, once,
 * rather than at every call site.
 */
export function at(
  series: readonly (number | null | undefined)[] | undefined,
  index: number,
): number | null {
  const value = series?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The index of the current hour in an hourly series that starts at local
 * midnight.
 *
 * Clamped rather than trusted: a short `forecast_hours` window, or an hour
 * boundary crossed between the request and the render, both put the clock past
 * the end of the array — which indexes `undefined` and, before `at` existed,
 * crashed on `.toFixed`.
 */
export function currentHourIndex(
  seriesLength: number,
  now: Date = new Date(),
): number {
  if (seriesLength <= 0) return 0;
  return Math.min(Math.max(now.getHours(), 0), seriesLength - 1);
}

/** The subset of the hourly payload a dashboard tile actually reads. */
export interface MarineReadings {
  waveHeight: number | null;
  waveDirection: number | null;
  wavePeriod: number | null;
  windWaveHeight: number | null;
  windWaveDirection: number | null;
  windWavePeriod: number | null;
  swellHeight: number | null;
  swellDirection: number | null;
  swellPeriod: number | null;
  currentVelocity: number | null;
  currentDirection: number | null;
  seaSurfaceTemperature: number | null;
}

/** Every reading for one hour, each already narrowed to `number | null`. */
export function readingsAt(
  marine: MarineResponse | undefined,
  index: number,
): MarineReadings {
  const h = marine?.hourly;
  return {
    waveHeight: at(h?.wave_height, index),
    waveDirection: at(h?.wave_direction, index),
    wavePeriod: at(h?.wave_period, index),
    windWaveHeight: at(h?.wind_wave_height, index),
    windWaveDirection: at(h?.wind_wave_direction, index),
    windWavePeriod: at(h?.wind_wave_period, index),
    swellHeight: at(h?.swell_wave_height, index),
    swellDirection: at(h?.swell_wave_direction, index),
    swellPeriod: at(h?.swell_wave_period, index),
    currentVelocity: at(h?.ocean_current_velocity, index),
    currentDirection: at(h?.ocean_current_direction, index),
    seaSurfaceTemperature: at(h?.sea_surface_temperature, index),
  };
}

/**
 * Does this response contain any usable wave data at all?
 *
 * The whole series is checked, not just the current hour, because a single null
 * mid-series is an ordinary gap in the model while an all-null series means the
 * coordinate is not at sea. Wave height is the discriminator: the marine model
 * always produces it where it produces anything, so a response with no finite
 * wave height anywhere has no coverage here.
 *
 * A missing `hourly` block counts as no data too — the caller gets one answer
 * to one question and does not have to also check for the shape.
 */
export function hasMarineData(marine: MarineResponse | undefined): boolean {
  const heights = marine?.hourly?.wave_height;
  if (!heights || heights.length === 0) return false;
  return heights.some(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}
