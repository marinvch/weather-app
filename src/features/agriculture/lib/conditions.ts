/**
 * Growing-condition readings for the agriculture dashboard's tiles.
 *
 * ## ⚠️ These disagree with `adviseAgriculture`, and cannot be reconciled here
 *
 * The mountain feature had the same duplication and it *was* resolvable: its
 * two avalanche scorers used the same four band names, so `avalancheReading`
 * could compose them by taking the more severe without inventing a number.
 *
 * **These two cannot be composed that way, because the same word means a
 * different thing on each side.**
 *
 * Frost — both are four bands, but the bands cover different temperatures:
 *
 * | Air temp | `frostRisk` (tile) | `adviseAgriculture` (card) |
 * |---|---|---|
 * | 6 °C, humidity > 80 | None | light |
 * | 3 °C | Low | moderate |
 * | 1 °C | Moderate | severe |
 * | −1 °C | High | severe |
 *
 * The tile's "Moderate" is 0–2 °C and the card's "moderate" is 2–5 °C — the
 * same word for adjacent, non-overlapping ranges. So a name-for-name
 * correspondence is not merely unproven, it is false, and composing on it would
 * assert something untrue about frost.
 *
 * Soil is worse. The tile's "Adequate" is 20–40 % volumetric moisture; the
 * card's "adequate" is *above 80 %*, i.e. waterlogged. One word, opposite
 * meanings, five bands against four, and the card also reads soil temperature
 * which the tile does not.
 *
 * Reconciling either one therefore means deciding what the words should mean —
 * whether 1 °C is "Moderate" frost or "severe" frost, and whether "adequate"
 * soil is dryish or saturated. That is a decision for whoever owns the agronomy,
 * not something to infer from the code. `conditions.test.ts` pins the conflict
 * so neither side can be quietly "fixed" alone; when it is resolved, that block
 * should fail and be replaced by an agreement test, exactly as the mountain
 * one was.
 *
 * The old local `severityColor` helper is gone: colour now comes from the risk
 * palette by way of `MetricTile`'s severity, which also carries the level in
 * the accessible name and a left accent rule — a colour-only signal was never
 * readable in sunlight or in greyscale.
 */

import type { RiskLevel } from "@/shared/types/weather";

/**
 * This feature's own severity scale — **three** steps, not the shared
 * `RiskLevel`'s four.
 *
 * Deliberately not migrated. There is no agronomic "severe" band here, and
 * inventing one to fill the fourth slot would put readings in a band the
 * thresholds never meant to produce. Conversion happens at the display
 * boundary, through the named records at the foot of this file.
 *
 * Two other unrelated types are also called `Severity`: mountain's, which has
 * four members and different words, and the numeric `0 | 1 | 2 | 3` exported by
 * `@/shared/ui/MetricTile`. Importing more than one into a file needs an alias.
 */
export type Severity = "low" | "medium" | "high";

export interface Reading {
  text: string;
  advice: string;
  severity: Severity;
}

/**
 * Open-Meteo reports `soil_moisture_0_1cm` as volumetric water content in
 * m³/m³ — a 0–1 fraction, not a percentage. Every threshold in this file and
 * in ./advice.ts is a percentage, so the reading has to be converted at the
 * boundary: 0.141 m³/m³ is 14.1% ("Dry"), not the 0.141 that read as
 * "Very dry — immediate irrigation needed" on well-watered soil.
 */
export function soilMoisturePercent(volumetric: number): number {
  return volumetric * 100;
}

/** Volumetric soil moisture, as a percentage. */
export function soilMoistureCondition(moisture: number): Reading {
  if (moisture < 10) {
    return {
      text: "Very dry",
      advice: "Immediate irrigation needed",
      severity: "high",
    };
  }
  if (moisture < 20) {
    return { text: "Dry", advice: "Consider irrigation", severity: "medium" };
  }
  if (moisture < 40) {
    return { text: "Adequate", advice: "Monitor closely", severity: "medium" };
  }
  if (moisture < 60) {
    return {
      text: "Good",
      advice: "Optimal for most crops",
      severity: "low",
    };
  }
  return {
    text: "Saturated",
    advice: "Risk of waterlogging",
    severity: "medium",
  };
}

/** Frost risk from air temperature in °C. */
export function frostRisk(temp: number): Reading {
  if (temp > 5) {
    return { text: "None", advice: "No frost risk", severity: "low" };
  }
  if (temp > 2) {
    return { text: "Low", advice: "Monitor temperature", severity: "medium" };
  }
  if (temp > 0) {
    return {
      text: "Moderate",
      advice: "Prepare frost protection",
      severity: "medium",
    };
  }
  return {
    text: "High",
    advice: "Immediate frost protection needed",
    severity: "high",
  };
}

/**
 * Overall growing conditions, scored across temperature, humidity and soil
 * moisture. Bands are generic "most crops" ranges, not crop-specific.
 */
export function growingConditions(
  temp: number,
  humidity: number,
  soilMoisture: number,
): { condition: string; severity: Severity } {
  let score = 0;

  // Temperature — optimal 15-25°C.
  if (temp >= 15 && temp <= 25) score += 3;
  else if (temp >= 10 && temp <= 30) score += 2;
  else if (temp >= 5 && temp <= 35) score += 1;

  // Humidity — optimal 40-70%.
  if (humidity >= 40 && humidity <= 70) score += 2;
  else if (humidity >= 30 && humidity <= 80) score += 1;

  // Soil moisture — optimal 30-60%.
  if (soilMoisture >= 30 && soilMoisture <= 60) score += 3;
  else if (soilMoisture >= 20 && soilMoisture <= 70) score += 2;
  else if (soilMoisture >= 10 && soilMoisture <= 80) score += 1;

  if (score >= 7) return { condition: "Excellent", severity: "low" };
  if (score >= 5) return { condition: "Good", severity: "low" };
  if (score >= 3) return { condition: "Fair", severity: "medium" };
  return { condition: "Poor", severity: "high" };
}

// ---------------------------------------------------------------------------
// Display boundary
// ---------------------------------------------------------------------------

/**
 * This scale's words, mapped onto the shared display scale — **by name, one
 * entry at a time, never by array index.**
 *
 * The scales are different lengths, so an index lookup would not even line up:
 * "high" is this scale's top step, while `RISK_LEVELS[2]` still leaves "severe"
 * above it. Written out, that difference is visible; as an index, it is not.
 */
const SEVERITY_TO_RISK_LEVEL: Record<Severity, RiskLevel> = {
  low: "low",
  medium: "moderate",
  high: "high",
};

/** Convert at the call site, for `RiskGauge`. Defaults to the calmest step. */
export function riskLevelFromSeverity(
  severity: Severity | undefined,
): RiskLevel {
  return severity ? SEVERITY_TO_RISK_LEVEL[severity] : "low";
}

/**
 * This scale's words as `MetricTile`'s numeric `severity` — again a named
 * record, for the same reason.
 */
const SEVERITY_TO_TILE: Record<Severity, 0 | 1 | 2 | 3> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** Convert at the call site, for `MetricTile`. Defaults to the calmest step. */
export function tileSeverity(severity: Severity | undefined): 0 | 1 | 2 | 3 {
  return severity ? SEVERITY_TO_TILE[severity] : 0;
}

/**
 * A shared `RiskLevel` as `MetricTile`'s numeric severity.
 *
 * For the readings this feature authored on the shared scale directly — the
 * spray verdict and the river trend, whose `risk` is assigned by hand in a
 * named branch rather than derived from a domain union. Still a record, not an
 * index.
 */
const RISK_LEVEL_TO_TILE: Record<RiskLevel, 0 | 1 | 2 | 3> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
};

/** Convert at the call site, for `MetricTile`. Defaults to the calmest step. */
export function tileSeverityFromRiskLevel(
  level: RiskLevel | undefined,
): 0 | 1 | 2 | 3 {
  return level ? RISK_LEVEL_TO_TILE[level] : 0;
}
