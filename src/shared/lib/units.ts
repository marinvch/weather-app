/**
 * Unit conversion and display formatting.
 *
 * **Open-Meteo is always queried in metric and every value held in this app is
 * metric.** Conversion happens once, at the moment a number is turned into a
 * string for a person — which is what these functions are. Nothing here should
 * ever be used to store or compare a reading: a threshold in
 * `features/*\/lib/advice.ts` is compared against the metric value, always, or
 * the same forecast scores differently depending on a display preference.
 *
 * Conversion factors are exact by definition, not approximations:
 * 1 mile = 1.609344 km, 1 nautical mile = 1.852 km, 1 inch = 25.4 mm.
 *
 * ## Where `soilMoisturePercent` lives
 *
 * It is **not** here. It sits in `src/features/agriculture/lib/conditions.ts`,
 * because volumetric soil moisture is an agronomy concept and nothing else in
 * the app reads it. `src/shared` may not import from a feature (ESLint
 * `no-restricted-imports`, `eslint.config.js`), so this file cannot re-export
 * it either — and a second copy of a conversion is exactly the bug that makes
 * two screens disagree. Import it from the feature that owns it. If a second
 * persona ever needs it, move the original here rather than copying it.
 */

import type { UserPreferences } from "@/shared/types/weather";

/**
 * The user's unit preference. Derived from `UserPreferences` rather than
 * redeclared, so the two can never drift apart.
 */
export type UnitSystem = UserPreferences["units"];

export type TemperatureUnit = "c" | "f";
export type SpeedUnit = "kmh" | "mph" | "ms" | "kn";
export type PrecipUnit = "mm" | "in";
export type DistanceUnit = "km" | "mi";

/** The four units a screen needs, resolved together from one preference. */
export interface UnitSet {
  temperature: TemperatureUnit;
  speed: SpeedUnit;
  precipitation: PrecipUnit;
  distance: DistanceUnit;
}

const KM_PER_MILE = 1.609344;
const KM_PER_NAUTICAL_MILE = 1.852;
const MM_PER_INCH = 25.4;

/**
 * `-0` is a real number in JavaScript and `(-0).toFixed(0)` is `"-0"`, so a
 * temperature of -0.3°C rounds to a displayed "-0°C". Adding zero collapses it.
 */
function unsign(value: number): number {
  return value === 0 ? 0 : value;
}

function fixed(value: number, decimals: number): string {
  return unsign(Number(value.toFixed(decimals))).toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Preference resolution
// ---------------------------------------------------------------------------

/**
 * Map the stored preference onto concrete units.
 *
 * Knots are not reachable from here on purpose: they are a *marine* choice, not
 * an imperial one — a mariner working in metric still wants wind in knots — so
 * the marine dashboard passes `"kn"` to `formatSpeed` explicitly.
 */
export function unitsFor(system: UnitSystem): UnitSet {
  return system === "imperial"
    ? { temperature: "f", speed: "mph", precipitation: "in", distance: "mi" }
    : { temperature: "c", speed: "kmh", precipitation: "mm", distance: "km" };
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return ((fahrenheit - 32) * 5) / 9;
}

/** Convert a speed from Open-Meteo's km/h. `to: "kmh"` returns it unchanged. */
export function convertSpeed(kmh: number, to: SpeedUnit): number {
  switch (to) {
    case "kmh":
      return kmh;
    case "mph":
      return kmh / KM_PER_MILE;
    case "ms":
      return kmh / 3.6;
    case "kn":
      return kmh / KM_PER_NAUTICAL_MILE;
  }
}

/** Convert a precipitation depth from Open-Meteo's millimetres. */
export function convertPrecip(mm: number, to: PrecipUnit): number {
  return to === "in" ? mm / MM_PER_INCH : mm;
}

/** Convert a distance from kilometres. */
export function convertDistance(km: number, to: DistanceUnit): number {
  return to === "mi" ? km / KM_PER_MILE : km;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface FormatTemperatureOptions {
  /** Decimal places. Default 0 — a forecast is not accurate to a tenth. */
  decimals?: number;
  /** Append the scale letter: `"12°C"` against `"12°"`. Default true. */
  showScale?: boolean;
  /** Render a leading `+` on positive values, for anomalies and deltas. */
  signed?: boolean;
}

/**
 * Format a **Celsius** value for display in the requested scale.
 *
 * The input is always Celsius — passing an already-converted Fahrenheit value
 * with `unit: "f"` double-converts and is the one way to misuse this.
 */
export function formatTemperature(
  celsius: number,
  unit: TemperatureUnit,
  opts: FormatTemperatureOptions = {},
): string {
  const { decimals = 0, showScale = true, signed = false } = opts;

  if (!Number.isFinite(celsius)) return "--°";

  const value = unit === "f" ? celsiusToFahrenheit(celsius) : celsius;
  const text = fixed(value, decimals);
  const sign = signed && Number(text) > 0 ? "+" : "";
  const scale = showScale ? (unit === "f" ? "F" : "C") : "";

  return `${sign}${text}°${scale}`;
}

const SPEED_LABEL: Record<SpeedUnit, string> = {
  kmh: "km/h",
  mph: "mph",
  ms: "m/s",
  kn: "kn",
};

/**
 * Decimals per unit rather than one rule for all four. A m/s reading spans
 * roughly 0–30, so whole numbers throw away a third of the useful resolution;
 * km/h and mph span 0–120, where a decimal is noise.
 */
const SPEED_DECIMALS: Record<SpeedUnit, number> = {
  kmh: 0,
  mph: 0,
  ms: 1,
  kn: 0,
};

/** Format a **km/h** value in the requested unit, with its label. */
export function formatSpeed(kmh: number, unit: SpeedUnit): string {
  if (!Number.isFinite(kmh)) return `-- ${SPEED_LABEL[unit]}`;
  return `${fixed(convertSpeed(kmh, unit), SPEED_DECIMALS[unit])} ${SPEED_LABEL[unit]}`;
}

/**
 * Format a **millimetre** depth in the requested unit, with its label.
 *
 * Inches get two decimals because one would round every drizzle hour to
 * `0.0 in` — a whole category of weather rendered as "none".
 */
export function formatPrecip(mm: number, unit: PrecipUnit): string {
  if (!Number.isFinite(mm)) return `-- ${unit}`;
  return unit === "in"
    ? `${fixed(convertPrecip(mm, "in"), 2)} in`
    : `${fixed(mm, 1)} mm`;
}

/** Format a **kilometre** distance in the requested unit, with its label. */
export function formatDistance(km: number, unit: DistanceUnit): string {
  if (!Number.isFinite(km)) return `-- ${unit}`;
  const value = convertDistance(km, unit);
  // Below 10 the first decimal is the difference between "just there" and "a
  // walk"; above it, it is clutter.
  return `${fixed(value, value < 10 ? 1 : 0)} ${unit}`;
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

const COMPASS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

/**
 * A meteorological bearing as a 16-point compass point.
 *
 * Each point spans 22.5°, centred on its bearing — so N is 348.75° through
 * 11.25°, wrapping across 0. The trailing `% 16` is what handles that wrap:
 * 350° rounds to index 16, which is N again, and without it the lookup is
 * `undefined` for the 11.25° either side of due north.
 *
 * The input is a *direction the wind comes from*, which is what Open-Meteo's
 * `wind_direction_10m` reports — a northerly blows toward the south.
 */
export function degreesToCardinal(deg: number): string {
  if (!Number.isFinite(deg)) return "--";
  const normalized = (((deg % 360) + 360) % 360) / 22.5;
  return COMPASS_16[Math.round(normalized) % 16];
}
