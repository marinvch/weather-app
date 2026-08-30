import { soilMoisturePercent } from "@/features/agriculture/lib/conditions";
import type {
  AgriculturalAnalysis,
  AgriculturalResponse,
} from "@/shared/types/weather";

/**
 * Growing advice, from a city balcony to a farm: soil condition, frost risk,
 * whether to irrigate. Pure — see features/forecast/lib/advice.ts.
 */
export const adviseAgriculture = (
  agri: AgriculturalResponse
): AgriculturalAnalysis => {
  if (!agri.current) {
    return {
      recommendation: "Weather data unavailable",
      confidence: 0,
      reasoning: "No weather data",
      riskLevel: "medium",
      profileSpecificTips: [],
      soilConditions: "adequate",
      irrigationNeeded: false,
      frostRisk: "none",
      plantingConditions: "Unknown",
    };
  }

  const temp = agri.current.temperature_2m;
  const soilTemp = agri.current.soil_temperature_0cm;
  // m³/m³ from the API; the thresholds below are percentages.
  const soilMoisture = soilMoisturePercent(agri.current.soil_moisture_0_1cm);
  const humidity = agri.current.relative_humidity_2m;

  let soilConditions: "excellent" | "good" | "adequate" | "poor" = "good";
  let frostRisk: "none" | "light" | "moderate" | "severe" = "none";
  let irrigationNeeded = false;
  let riskLevel: "low" | "medium" | "high" = "low";
  const tips: string[] = [];

  // Soil analysis
  if (soilMoisture < 20) {
    soilConditions = "poor";
    irrigationNeeded = true;
    riskLevel = "medium";
    tips.push("Immediate irrigation recommended");
  } else if (soilMoisture > 80) {
    soilConditions = "adequate";
    riskLevel = "medium";
    tips.push("Risk of waterlogging - improve drainage");
  } else if (soilTemp > 15 && soilMoisture > 40 && soilMoisture < 70) {
    soilConditions = "excellent";
    tips.push("Optimal conditions for plant growth");
  }

  // Frost risk assessment
  if (temp < 2) {
    frostRisk = "severe";
    riskLevel = "high";
    tips.push("Protect sensitive crops immediately");
  } else if (temp < 5) {
    frostRisk = "moderate";
    riskLevel = "medium";
    tips.push("Monitor temperature closely");
  } else if (temp < 8 && humidity > 80) {
    frostRisk = "light";
    tips.push("Possible light frost - take precautions");
  }

  // Planting conditions analysis
  let plantingConditions = "Good";
  if (soilTemp < 10) {
    plantingConditions = "Too cold for most crops";
    tips.push("Wait for soil to warm up");
  } else if (soilTemp > 25 && soilMoisture < 30) {
    plantingConditions = "Too hot and dry";
    tips.push("Improve soil moisture before planting");
  } else if (frostRisk !== "none") {
    plantingConditions = "Risk of frost damage";
  } else if (soilConditions === "excellent") {
    plantingConditions = "Excellent for planting";
    tips.push("Ideal time for sowing");
  }

  // Harvest recommendations
  let harvestRecommendation = "";
  if (humidity < 60 && temp > 15 && temp < 25) {
    harvestRecommendation = "Good conditions for harvesting";
  } else if (humidity > 80) {
    harvestRecommendation = "High humidity - delay harvest if possible";
  }

  return {
    recommendation: `${soilConditions} soil conditions, ${frostRisk} frost risk`,
    confidence: 90,
    reasoning: `Soil: ${soilTemp}°C/${soilMoisture.toFixed(1)}%, Air: ${temp}°C, Humidity: ${humidity}%`,
    riskLevel,
    profileSpecificTips: tips,
    soilConditions,
    irrigationNeeded,
    frostRisk,
    plantingConditions,
    harvestRecommendation: harvestRecommendation || undefined,
  };
};
