/**
 * The two scales a mariner actually reads: **Douglas** for the sea and
 * **Beaufort** for the wind.
 *
 * Both are published, standard scales with fixed boundaries — the numbers below
 * are not tuning knobs. They are transcribed from the WMO tables, so changing
 * one is changing what "force 8" means, not adjusting a threshold.
 *
 * Everything here is pure and takes metric input, because that is what the app
 * holds: **wave height in metres, wind speed in km/h**. Display conversion is
 * `@/shared/lib/units`' job and happens after the classification, never before —
 * classifying a converted figure is how the same sea reads as two different
 * states depending on a display preference.
 */

import { convertSpeed } from "@/shared/lib/units";
import type { RiskLevel } from "@/shared/types/weather";

// ---------------------------------------------------------------------------
// Douglas sea state — degree of sea, 0 to 9
// ---------------------------------------------------------------------------

export type DouglasDegree = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface DouglasSeaState {
  degree: DouglasDegree;
  /** The scale's own name for the degree — "Rough", "Very high". */
  label: string;
  /** What it means for a small boat, in a sentence. */
  description: string;
  /** The degree mapped onto the app's four-step display scale. */
  risk: RiskLevel;
}

/**
 * The Douglas table, in order. `min` is the **inclusive lower bound** of
 * significant wave height in metres; the next row's `min` is the exclusive
 * upper bound, so 0.5 m is degree 3 and not degree 2.
 *
 * Degree 0 is a separate case from degree 1: the scale distinguishes a glassy
 * sea (exactly calm) from a rippled one, so its band is the single value 0.
 */
const DOUGLAS: readonly {
  degree: DouglasDegree;
  min: number;
  label: string;
  description: string;
  risk: RiskLevel;
}[] = [
  {
    degree: 0,
    min: 0,
    label: "Calm (glassy)",
    description: "No waves. Mirror-flat water.",
    risk: "low",
  },
  {
    degree: 1,
    min: 0.0001,
    label: "Calm (rippled)",
    description: "Ripples only. Comfortable in any craft.",
    risk: "low",
  },
  {
    degree: 2,
    min: 0.1,
    label: "Smooth",
    description: "Small wavelets. Easy going for a small boat.",
    risk: "low",
  },
  {
    degree: 3,
    min: 0.5,
    label: "Slight",
    description: "Short waves with the odd whitecap. Workable in a small boat.",
    risk: "low",
  },
  {
    degree: 4,
    min: 1.25,
    label: "Moderate",
    description: "Frequent whitecaps. An open boat will take spray.",
    risk: "moderate",
  },
  {
    degree: 5,
    min: 2.5,
    label: "Rough",
    description: "Large waves, spray throughout. Experienced crews only.",
    risk: "high",
  },
  {
    degree: 6,
    min: 4,
    label: "Very rough",
    description: "Steep breaking seas. Small craft should not be out.",
    risk: "high",
  },
  {
    degree: 7,
    min: 6,
    label: "High",
    description: "Foam blown in streaks. Visibility reduced by spray.",
    risk: "severe",
  },
  {
    degree: 8,
    min: 9,
    label: "Very high",
    description: "Very high waves with overhanging crests. Survival conditions.",
    risk: "severe",
  },
  {
    degree: 9,
    min: 14,
    label: "Phenomenal",
    description: "Sea completely white. Do not put to sea.",
    risk: "severe",
  },
] as const;

/**
 * Significant wave height in metres to a Douglas degree.
 *
 * Returns `null` for `null` input, which is a real case and not a defensive
 * check: the marine API answers an inland coordinate with a series of nulls and
 * HTTP 200, so "no data" and "flat calm" must not render as the same thing. The
 * caller renders an empty state; it does not substitute a zero.
 *
 * A negative height is not a sea state either — it is a corrupt reading — so it
 * answers `null` rather than clamping to calm.
 */
export function douglasFromWaveHeight(
  metres: number | null | undefined,
): DouglasSeaState | null {
  if (metres == null || !Number.isFinite(metres) || metres < 0) return null;

  // Walk down from the top so the first match is the highest band the height
  // reaches. `at(-1)` cannot be undefined — the table is non-empty and the
  // degree-0 band admits 0 — but the `??` keeps TypeScript honest.
  const band =
    [...DOUGLAS].reverse().find((row) => metres >= row.min) ?? DOUGLAS[0];

  return {
    degree: band.degree,
    label: band.label,
    description: band.description,
    risk: band.risk,
  };
}

// ---------------------------------------------------------------------------
// Beaufort wind force — 0 to 12
// ---------------------------------------------------------------------------

export type BeaufortForce =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface BeaufortReading {
  force: BeaufortForce;
  /** The scale's own name — "Fresh breeze", "Near gale". */
  label: string;
  /** The sea criterion the scale defines the force by. */
  description: string;
  risk: RiskLevel;
}

/**
 * The Beaufort table, in order, with `minKnots` as the **inclusive lower bound
 * in knots** — the scale's own unit, as published.
 *
 * Defined in knots rather than km/h on purpose. Every km/h column in print is a
 * rounded restatement of this one, and rounding twice (km/h to a rounded table,
 * then reading a boundary) puts force 3/4 and force 7/8 a whole knot out. The
 * conversion happens once, here, through the shared exact factor.
 */
const BEAUFORT: readonly {
  force: BeaufortForce;
  minKnots: number;
  label: string;
  description: string;
  risk: RiskLevel;
}[] = [
  { force: 0, minKnots: 0, label: "Calm", description: "Sea like a mirror.", risk: "low" },
  { force: 1, minKnots: 1, label: "Light air", description: "Ripples, no foam crests.", risk: "low" },
  { force: 2, minKnots: 4, label: "Light breeze", description: "Small wavelets, glassy crests.", risk: "low" },
  { force: 3, minKnots: 7, label: "Gentle breeze", description: "Large wavelets, scattered whitecaps.", risk: "low" },
  { force: 4, minKnots: 11, label: "Moderate breeze", description: "Small waves, fairly frequent whitecaps.", risk: "moderate" },
  { force: 5, minKnots: 17, label: "Fresh breeze", description: "Moderate waves, many whitecaps, some spray.", risk: "moderate" },
  { force: 6, minKnots: 22, label: "Strong breeze", description: "Large waves, extensive foam crests, spray.", risk: "high" },
  { force: 7, minKnots: 28, label: "Near gale", description: "Sea heaps up, foam blown in streaks.", risk: "high" },
  { force: 8, minKnots: 34, label: "Gale", description: "Moderately high waves, crests break into spindrift.", risk: "severe" },
  { force: 9, minKnots: 41, label: "Strong gale", description: "High waves, dense foam, spray affects visibility.", risk: "severe" },
  { force: 10, minKnots: 48, label: "Storm", description: "Very high waves, sea surface white, visibility reduced.", risk: "severe" },
  { force: 11, minKnots: 56, label: "Violent storm", description: "Exceptionally high waves, sea covered in foam.", risk: "severe" },
  { force: 12, minKnots: 64, label: "Hurricane force", description: "Air filled with foam and spray. Sea entirely white.", risk: "severe" },
] as const;

/**
 * Wind speed in **km/h** to a Beaufort force.
 *
 * km/h is the input because that is the unit Open-Meteo answers in and the unit
 * this app stores. Nothing calls this with an already-converted figure.
 */
export function beaufortFromKmh(
  kmh: number | null | undefined,
): BeaufortReading | null {
  if (kmh == null || !Number.isFinite(kmh) || kmh < 0) return null;

  const knots = convertSpeed(kmh, "kn");
  const band =
    [...BEAUFORT].reverse().find((row) => knots >= row.minKnots) ?? BEAUFORT[0];

  return {
    force: band.force,
    label: band.label,
    description: band.description,
    risk: band.risk,
  };
}

/** The lower bound of a force in knots, for a caption or an axis label. */
export function beaufortLowerBoundKnots(force: BeaufortForce): number {
  return BEAUFORT[force].minKnots;
}

// ---------------------------------------------------------------------------
// Swell against wind wave
// ---------------------------------------------------------------------------

export type SeaComposition = "swell-dominated" | "wind-dominated" | "mixed";

export interface SwellSeparation {
  composition: SeaComposition;
  /** Swell height as a share of the two components, 0–1. */
  swellShare: number;
  /** What the split means for the ride, in a sentence. */
  description: string;
}

/**
 * Split the sea into the part the local wind is making and the part that
 * arrived from somewhere else.
 *
 * This is the reading a small boat actually cares about and it is invisible in
 * the significant wave height alone: 1.5 m of long-period swell is a gentle
 * roll, while 1.5 m of wind wave on the same day is short, steep and wet. The
 * boundary is a **judgement**, not a published scale — 65% of the combined
 * height calls it, which is roughly where one component stops being felt
 * through the other.
 */
export function swellSeparation(
  swellHeight: number | null | undefined,
  windWaveHeight: number | null | undefined,
): SwellSeparation | null {
  if (
    swellHeight == null ||
    windWaveHeight == null ||
    !Number.isFinite(swellHeight) ||
    !Number.isFinite(windWaveHeight) ||
    swellHeight < 0 ||
    windWaveHeight < 0
  ) {
    return null;
  }

  const total = swellHeight + windWaveHeight;
  // A dead flat sea has no composition to report, and dividing by zero here
  // would answer NaN rather than "calm".
  if (total === 0) {
    return {
      composition: "mixed",
      swellShare: 0,
      description: "Flat — neither swell nor wind wave to speak of.",
    };
  }

  const swellShare = swellHeight / total;

  if (swellShare >= 0.65) {
    return {
      composition: "swell-dominated",
      swellShare,
      description:
        "Mostly swell from distant weather — a long, regular roll rather than a chop.",
    };
  }
  if (swellShare <= 0.35) {
    return {
      composition: "wind-dominated",
      swellShare,
      description:
        "Mostly locally generated wind wave — short, steep and wet, and it will ease when the wind does.",
    };
  }
  return {
    composition: "mixed",
    swellShare,
    description:
      "Swell and wind wave of similar size — expect a confused, irregular sea.",
  };
}

// ---------------------------------------------------------------------------
// Sea temperature
// ---------------------------------------------------------------------------

export interface WaterReading {
  text: string;
  /** Immersion guidance — what happens to a person in the water. */
  advice: string;
  risk: RiskLevel;
}

/**
 * Sea surface temperature in °C to immersion guidance.
 *
 * Banded on cold-water immersion physiology rather than on comfort: cold shock
 * is the thing that kills in the first minute, and its onset is around 15°C
 * regardless of how pleasant the air is. The bands are advisory, not a
 * standard.
 */
export function waterTemperatureReading(
  celsius: number | null | undefined,
): WaterReading | null {
  if (celsius == null || !Number.isFinite(celsius)) return null;

  if (celsius < 5) {
    return {
      text: "Near freezing",
      advice:
        "Immersion is immediately life-threatening. A dry suit and a plan to be recovered fast, or do not go.",
      risk: "severe",
    };
  }
  if (celsius < 10) {
    return {
      text: "Very cold",
      advice:
        "Cold shock within seconds and useful movement lost in minutes. Wear a suit and a lifejacket.",
      risk: "high",
    };
  }
  if (celsius < 15) {
    return {
      text: "Cold",
      advice: "Cold shock still likely on immersion. Thermal protection needed.",
      risk: "moderate",
    };
  }
  if (celsius < 20) {
    return {
      text: "Cool",
      advice: "Tolerable briefly, but a long immersion still chills. Wear a wetsuit.",
      risk: "low",
    };
  }
  return {
    text: "Mild",
    advice: "Comfortable for swimming and water sports.",
    risk: "low",
  };
}

// ---------------------------------------------------------------------------
// Display boundary
// ---------------------------------------------------------------------------

/**
 * A `RiskLevel` as `MetricTile`'s numeric `severity` — **a named record, not
 * an array index.**
 *
 * The readings in this file carry `RiskLevel` directly rather than a local
 * union, because Douglas and Beaufort are published scales whose own steps are
 * numbers (0–9, 0–12): there is no third vocabulary to preserve, and each
 * table row assigns its `risk` by hand on its own line. An index lookup into
 * `RISK_LEVELS` would give the same answer today and would stop doing so the
 * moment that array changed, silently.
 */
const RISK_LEVEL_TO_TILE: Record<RiskLevel, 0 | 1 | 2 | 3> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
};

/** Convert at the call site, for `MetricTile`. Defaults to the calmest step. */
export function tileSeverity(level: RiskLevel | undefined): 0 | 1 | 2 | 3 {
  return level ? RISK_LEVEL_TO_TILE[level] : 0;
}
