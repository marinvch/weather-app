import type { MountainAnalysis, WeatherResponse } from "@/shared/types/weather";

/**
 * Ascent-planning advice: avalanche risk, wind exposure, visibility, how cold
 * it will actually feel. Pure — see the note in features/forecast/lib/advice.ts.
 */
export const adviseMountain = (
  weather: WeatherResponse
): MountainAnalysis => {
  if (!weather.current) {
    return {
      recommendation: "Weather data unavailable",
      confidence: 0,
      reasoning: "No weather data",
      riskLevel: "medium",
      profileSpecificTips: [],
      avalancheRisk: "low",
      visibilityForecast: "Unknown",
      windExposure: "Unknown",
      temperatureGradient: "Unknown",
    };
  }

  const temp = weather.current.temperature_2m;
  const windSpeed = weather.current.wind_speed_10m;
  const weatherCode = weather.current.weather_code;

  let avalancheRisk: "low" | "moderate" | "considerable" | "high" | "extreme" =
    "low";
  let riskLevel: "low" | "medium" | "high" = "low";
  let windExposure = "Mild";

  // Mountain-specific risk assessment
  if (temp > 0 && temp < 3) {
    // Temperature near freezing - higher avalanche risk
    avalancheRisk = "moderate";
    riskLevel = "medium";
  }

  if (windSpeed > 40) {
    windExposure = "Extreme";
    riskLevel = "high";
  } else if (windSpeed > 25) {
    windExposure = "High";
    riskLevel = "medium";
  } else if (windSpeed > 15) {
    windExposure = "Moderate";
  }

  // Weather conditions affecting visibility
  if (weatherCode > 70) {
    // Snow/storms
    avalancheRisk = "high";
    riskLevel = "high";
  }

  return {
    recommendation: `${avalancheRisk} avalanche risk, ${windExposure.toLowerCase()} wind exposure`,
    confidence: 82,
    reasoning: `Temperature: ${temp}°C, wind: ${windSpeed}km/h, weather code: ${weatherCode}`,
    riskLevel,
    profileSpecificTips: [
      avalancheRisk === "high"
        ? "Avoid steep slopes and wind-loaded areas"
        : "Check local avalanche bulletins",
      windSpeed > 30
        ? "Strong winds - protect exposed skin"
        : "Moderate wind conditions",
      temp < -10
        ? "Extreme cold - risk of frostbite"
        : "Dress appropriately for temperature",
    ],
    avalancheRisk,
    visibilityForecast: weatherCode <= 3 ? "Good" : "Limited due to weather",
    windExposure,
    temperatureGradient: `Surface: ${temp}°C, potential -6°C per 1000m elevation`,
  };
};
