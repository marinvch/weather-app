/**
 * Condition readings for the mountain dashboard's summary tiles.
 *
 * ⚠️ These duplicate, and disagree with, `adviseMountain` in ./advice.ts.
 *
 * `adviseMountain` classifies avalanche risk from single thresholds (a 0–3°C
 * melt-freeze band, weather code > 70). `avalancheRisk` below accumulates
 * points across temperature, wind and precipitation, and reports on a four-step
 * scale with different labels. The same conditions can therefore be "moderate"
 * in the advice card and "High" in the tile directly above it.
 *
 * Both are preserved here exactly as they behaved before the MUI migration,
 * because picking a winner is a domain decision about avalanche safety, not a
 * refactor. It needs resolving — see the note in features/AGENTS.md.
 */

export type Severity = "low" | "medium" | "high" | "extreme";

export interface WindCondition {
  text: string;
  severity: Severity;
}

/** Wind speed in km/h to a plain-language reading. */
export function windCondition(speed: number): WindCondition {
  if (speed < 20) return { text: "Calm", severity: "low" };
  if (speed < 40) return { text: "Breezy", severity: "medium" };
  if (speed < 60) return { text: "Windy", severity: "high" };
  return { text: "Dangerous", severity: "extreme" };
}

export interface VisibilityCondition {
  text: string;
  cause: string;
  severity: Severity;
}

/** WMO weather code to a visibility reading. */
export function visibilityCondition(weatherCode: number): VisibilityCondition {
  if ([45, 48].includes(weatherCode)) {
    return { text: "Poor", cause: "Fog", severity: "high" };
  }
  if ([51, 53, 55, 61, 63, 65].includes(weatherCode)) {
    return { text: "Reduced", cause: "Rain", severity: "medium" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return { text: "Poor", cause: "Snow", severity: "high" };
  }
  return { text: "Good", cause: "Clear conditions", severity: "low" };
}

export interface AvalancheReading {
  level: string;
  description: string;
  severity: Severity;
}

/**
 * Points-based avalanche reading. See the warning at the top of this file —
 * this is not the same calculation as `adviseMountain`.
 */
export function avalancheRisk(
  temp: number,
  windSpeed: number,
  weatherCode: number,
): AvalancheReading {
  let risk = 0;

  // Near freezing: melt-freeze cycling weakens the pack.
  if (temp > -2 && temp < 2) risk += 2;
  if (temp > 0) risk += 1;

  // Wind loads lee slopes.
  if (windSpeed > 40) risk += 2;
  if (windSpeed > 60) risk += 1;

  // Fresh snow.
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) risk += 2;
  // Rain on snow.
  if ([61, 63, 65].includes(weatherCode) && temp < 5) risk += 1;

  if (risk <= 2) {
    return {
      level: "Low",
      description: "Generally safe conditions",
      severity: "low",
    };
  }
  if (risk <= 4) {
    return {
      level: "Moderate",
      description: "Use caution on steep slopes",
      severity: "medium",
    };
  }
  if (risk <= 6) {
    return {
      level: "High",
      description: "Avoid steep terrain",
      severity: "high",
    };
  }
  return {
    level: "Extreme",
    description: "Travel not recommended",
    severity: "extreme",
  };
}

/** MUI palette colour for a severity. */
export function severityColor(
  severity: Severity,
): "success" | "warning" | "error" {
  if (severity === "low") return "success";
  if (severity === "medium") return "warning";
  return "error";
}
