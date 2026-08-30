/**
 * Growing-condition readings for the agriculture dashboard's tiles.
 *
 * Extracted from the dashboard so they can be tested. Note these overlap with
 * `adviseAgriculture` in ./advice.ts, which derives its own soil condition and
 * frost risk on different thresholds — the same caveat as the mountain feature,
 * and the same unresolved decision. See features/AGENTS.md.
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

/** MUI palette colour for a severity. */
export function severityColor(
  severity: Severity,
): "success" | "warning" | "error" {
  if (severity === "low") return "success";
  if (severity === "medium") return "warning";
  return "error";
}
