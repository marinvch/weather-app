/** Compass points, 16-way. */
const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function directionText(degrees: number): string {
  return COMPASS[Math.round(degrees / 22.5) % 16];
}

export type SeaSeverity = "unknown" | "low" | "medium" | "high";

export interface SeaCondition {
  text: string;
  severity: SeaSeverity;
}

/**
 * Significant wave height in metres to a sea-state reading.
 *
 * `null` is a real case, not a defensive check: the marine API answers an
 * inland coordinate with a series of nulls rather than an error, so "no data"
 * and "flat calm" must not render the same.
 */
export function seaCondition(waveHeight: number | null): SeaCondition {
  if (waveHeight == null) return { text: "No data", severity: "unknown" };
  if (waveHeight < 0.5) return { text: "Calm", severity: "low" };
  if (waveHeight < 1.0) return { text: "Slight", severity: "low" };
  if (waveHeight < 2.0) return { text: "Moderate", severity: "medium" };
  if (waveHeight < 4.0) return { text: "Rough", severity: "high" };
  return { text: "Very rough", severity: "high" };
}

export function seaSeverityColor(
  severity: SeaSeverity,
): "success" | "warning" | "error" | undefined {
  if (severity === "unknown") return undefined;
  if (severity === "low") return "success";
  if (severity === "medium") return "warning";
  return "error";
}
