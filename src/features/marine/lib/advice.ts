import type { MarineAnalysis, MarineResponse } from "@/shared/types/weather";

/**
 * Sea-state advice for fishermen and boat watchers: is it worth going out,
 * what the waves are doing. Pure — see features/forecast/lib/advice.ts.
 */
export const adviseMarine = (marine: MarineResponse): MarineAnalysis => {
  const waveHeight = marine.hourly.wave_height[0] || 0;
  const windWaveHeight = marine.hourly.wind_wave_height[0] || 0;
  const seaTemp = marine.hourly.sea_surface_temperature[0] || 15;
  const currentVelocity = marine.hourly.ocean_current_velocity[0] || 0;

  let fishingConditions: "excellent" | "good" | "fair" | "poor" = "good";
  let riskLevel: "low" | "medium" | "high" = "low";
  const tips: string[] = [];

  // Wave analysis
  if (waveHeight > 3) {
    fishingConditions = "poor";
    riskLevel = "high";
    tips.push("Dangerous conditions - consider postponing trip");
  } else if (waveHeight > 2) {
    fishingConditions = "fair";
    riskLevel = "medium";
    tips.push("Moderate seas - experienced mariners only");
  } else if (waveHeight < 0.5 && seaTemp > 18) {
    fishingConditions = "excellent";
    tips.push("Ideal conditions for fishing");
  } else {
    tips.push("Good conditions for most marine activities");
  }

  // Sea temperature analysis
  if (seaTemp > 22) {
    tips.push("Warm water - excellent for swimming and water sports");
  } else if (seaTemp < 12) {
    tips.push("Cold water - use appropriate thermal protection");
  }

  // Current analysis
  if (currentVelocity > 1.5) {
    tips.push("Strong currents present - adjust navigation accordingly");
    if (riskLevel === "low") riskLevel = "medium";
  }

  // Best time analysis
  let bestTime = "All day suitable";
  if (waveHeight > 1.5) {
    bestTime = "Early morning typically calmer";
  }

  return {
    recommendation: `${fishingConditions} fishing conditions with ${waveHeight}m waves`,
    confidence: 92,
    reasoning: `Wave height: ${waveHeight}m, Sea temp: ${seaTemp}°C, Current: ${currentVelocity}m/s`,
    riskLevel,
    profileSpecificTips: tips,
    bestTimeForActivity: bestTime,
    fishingConditions,
    seaState:
      waveHeight > 2.5
        ? "Rough"
        : waveHeight > 1.5
        ? "Moderate"
        : waveHeight > 0.5
        ? "Slight"
        : "Calm",
    waveAnalysis: `Significant wave height: ${waveHeight}m, Wind waves: ${windWaveHeight}m`,
    tideRecommendation:
      currentVelocity > 1
        ? "Strong tidal flow - plan accordingly"
        : "Moderate tidal conditions",
  };
};
