/**
 * River discharge as a flood-risk indicator.
 *
 * Open-Meteo's flood host serves **GloFAS** daily river discharge in m³/s for
 * the modelled river cell nearest a coordinate. Two properties of that shape
 * everything here:
 *
 * 1. **A coordinate with no modelled river nearby answers 200 with nulls.**
 *    Not an error, not an empty array — a full-length series of nulls. So a
 *    present response is never proof of usable data, exactly as with the marine
 *    host, and `hasRiverData` is the question the caller actually has.
 * 2. **The absolute figure means nothing on its own.** 400 m³/s is a drought on
 *    the Danube and a catastrophe on a chalk stream. Without a return-period
 *    baseline — which the free endpoint does not provide — the only honest
 *    reading is the *shape* of the forecast: is the river rising, and by how
 *    much against its own recent level.
 *
 * So this file reports a **trend**, and says plainly that it is not a flood
 * forecast. Anything stronger would be inventing a threshold that does not
 * exist.
 */

import type { FloodResponse, RiskLevel } from "@/shared/types/weather";

export type DischargeTrend = "falling" | "steady" | "rising" | "rising-sharply";

export interface RiverReading {
  /** Latest modelled discharge, m³/s. */
  currentM3s: number;
  /** Mean across the whole returned window, m³/s — the comparison baseline. */
  windowMeanM3s: number;
  /** Highest value anywhere in the window, m³/s. */
  peakM3s: number;
  /** Days from the start of the window to the peak. */
  daysToPeak: number;
  /** Peak as a multiple of the current level. 1 means no rise ahead. */
  peakRatio: number;
  trend: DischargeTrend;
  risk: RiskLevel;
  text: string;
  advice: string;
}

/** Does this response carry any modelled discharge at all? */
export function hasRiverData(flood: FloodResponse | undefined): boolean {
  const series = flood?.daily?.river_discharge;
  if (!series || series.length === 0) return false;
  return series.some((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * Read the discharge series into a trend.
 *
 * Bands on `peakRatio` — the forecast peak against today's level — because that
 * ratio is dimensionless and therefore comparable between a chalk stream and
 * the Danube, which the raw m³/s figure is not. They are advisory bands chosen
 * to be readable, not hydrological thresholds; a doubling in a week is a
 * genuinely notable rise on most catchments, and the wording never claims more
 * than "the model has the river rising".
 */
export function readRiverDischarge(
  flood: FloodResponse | undefined,
): RiverReading | null {
  const series = flood?.daily?.river_discharge;
  if (!series) return null;

  const points = series
    .map((value, index) => ({ value, index }))
    .filter(
      (p): p is { value: number; index: number } =>
        typeof p.value === "number" && Number.isFinite(p.value),
    );

  if (points.length === 0) return null;

  const currentM3s = points[0].value;
  const windowMeanM3s =
    points.reduce((sum, p) => sum + p.value, 0) / points.length;

  const peak = points.reduce((a, b) => (b.value > a.value ? b : a));
  const peakM3s = peak.value;
  const daysToPeak = peak.index;

  // A dry channel is a real reading, and dividing by it is not. Treat a zero
  // current level as "no rise measurable" rather than as an infinite ratio.
  const peakRatio = currentM3s > 0 ? peakM3s / currentM3s : 1;

  let trend: DischargeTrend;
  let risk: RiskLevel;
  let text: string;
  let advice: string;

  if (peakRatio >= 2) {
    trend = "rising-sharply";
    risk = "high";
    text = "Rising sharply";
    advice = `The model has discharge more than doubling within ${daysToPeak} day${daysToPeak === 1 ? "" : "s"}, to ${peakM3s.toFixed(0)} m³/s. Move stock and machinery off low ground and check the local flood warning service.`;
  } else if (peakRatio >= 1.3) {
    trend = "rising";
    risk = "moderate";
    text = "Rising";
    advice = `Discharge is forecast to rise to ${peakM3s.toFixed(0)} m³/s over ${daysToPeak} day${daysToPeak === 1 ? "" : "s"}. Expect wet ground near the watercourse; delay any traffic on riverside fields.`;
  } else if (currentM3s > windowMeanM3s * 1.15) {
    // The series runs forward from today, so "falling" is today sitting well
    // above the average of the days ahead — not below it. Getting this the
    // wrong way round reports a receding flood as a rising one.
    trend = "falling";
    risk = "low";
    text = "Falling";
    advice =
      "Today's discharge is above the average of the days ahead — the river is receding. Riverside ground should be drying.";
  } else {
    trend = "steady";
    risk = "low";
    text = "Steady";
    advice = "No significant change in river level forecast for this window.";
  }

  return {
    currentM3s,
    windowMeanM3s,
    peakM3s,
    daysToPeak,
    peakRatio,
    trend,
    risk,
    text,
    advice,
  };
}

/**
 * The caveat that must accompany any river figure this app shows.
 *
 * Exported rather than written into a component so it cannot drift from the
 * reasoning above, and so the same words appear wherever discharge does.
 */
export const RIVER_DISCHARGE_CAVEAT =
  "Modelled discharge for the nearest GloFAS river cell, which may be some distance from this point. It describes a river, not the rain here, and without a return-period baseline it is a trend — not a flood forecast. Your national flood warning service is the authority.";
