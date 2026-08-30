import type { AIAnalysis, WeatherResponse } from "@/shared/types/weather";

/**
 * The general-public advice rules: "how should I dress today".
 *
 * A pure function from a forecast to a recommendation — no network, no store,
 * no React. This is the product, so it lives in the feature that owns the
 * persona rather than inside the transport layer where it started.
 *
 * Not a model. The thresholds are hand-written and `confidence` is a constant;
 * see CONTEXT.md on why this is not called "AI" anywhere it matters.
 */
export const adviseGeneral = (weather: WeatherResponse): AIAnalysis => {
  if (!weather.current) {
    return {
      recommendation: "Weather data unavailable",
      confidence: 0,
      reasoning: "No current weather data",
      riskLevel: "medium",
      profileSpecificTips: [],
    };
  }

  const temp = weather.current.temperature_2m;
  const wind = weather.current.wind_speed_10m;
  const weatherCode = weather.current.weather_code;

  let recommendation = "";
  let riskLevel: "low" | "medium" | "high" = "low";
  const tips: string[] = [];

  // Temperature analysis
  if (temp > 25) {
    recommendation = "Perfect weather for outdoor activities! ";
    tips.push("Stay hydrated and use sun protection");
  } else if (temp < 5) {
    recommendation = "Cold weather - dress warmly. ";
    riskLevel = "medium";
    tips.push("Layer clothing and protect extremities");
  } else {
    recommendation = "Comfortable weather conditions. ";
  }

  // Wind analysis
  if (wind > 20) {
    recommendation += "Strong winds present.";
    riskLevel = "medium";
    tips.push("Secure loose objects and be cautious outdoors");
  }

  // Weather code analysis
  if (weatherCode >= 61 && weatherCode <= 65) {
    recommendation += " Rain expected - carry an umbrella.";
    tips.push("Wear waterproof clothing");
  } else if (weatherCode >= 71 && weatherCode <= 75) {
    recommendation += " Snow conditions - exercise caution.";
    riskLevel = "high";
    tips.push("Use appropriate footwear for slippery conditions");
  }

  return {
    recommendation,
    confidence: 85,
    reasoning: `Based on temperature ${temp}°C, wind speed ${wind} km/h, and weather conditions`,
    riskLevel,
    profileSpecificTips: tips,
  };
};

