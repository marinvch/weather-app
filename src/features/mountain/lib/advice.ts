import type { MountainForecastResponse } from "@/features/mountain/api/mountainApi";
import {
  atCurrentHour,
  avalancheReading,
  exposureFromWindChill,
  freezingLevelReading,
  snowDepthReading,
  windAmplification,
  ascentWindProfile,
  windChill,
  windChillApplies,
} from "@/features/mountain/lib/conditions";
import type { MountainAnalysis } from "@/shared/types/weather";

/**
 * Ascent-planning advice: avalanche risk, wind exposure, visibility, how cold
 * it will actually feel.
 *
 * Deterministic and rule-based. Nothing here calls a model — every branch is a
 * hand-written threshold and `confidence` is a hand-assigned constant standing
 * for how much of the picture the rules could see, not a measured certainty.
 *
 * ⚠️ The avalanche thresholds below disagree with the points-based
 * `avalancheRisk` in ./conditions.ts. That disagreement is deliberate and
 * pinned by a test; see the note at the top of that file. **The core scoring
 * here is unchanged** — the additions are the wind-chill, freezing-level and
 * snow-depth readings, which add tips without moving any existing threshold.
 */

export interface AdviseMountainOptions {
  /** Injectable clock, for reading the hourly series at the current hour. */
  now?: Date;
}

export const adviseMountain = (
  weather: MountainForecastResponse,
  options: AdviseMountainOptions = {},
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

  const now = options.now ?? new Date();

  const temp = weather.current.temperature_2m;
  const windSpeed = weather.current.wind_speed_10m;
  const weatherCode = weather.current.weather_code;

  // Avalanche danger comes from the one scorer both this and the dashboard
  // tile read, so the advice card and the tile above it can no longer disagree
  // about the same data. Its thresholds are unchanged — see `avalancheReading`.
  const avalanche = avalancheReading(temp, windSpeed, weatherCode);
  const avalancheRisk = avalanche.danger;

  let riskLevel: "low" | "medium" | "high" = "low";
  let windExposure = "Mild";

  // `riskLevel` is a separate, coarser judgement about the day as a whole and
  // keeps its own thresholds — it is not the avalanche scale.
  if (temp > 0 && temp < 3) {
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

  // Snow and storms. The avalanche half of this rule now lives in
  // `avalancheThresholdDanger`, which `avalancheReading` composes; what is left
  // here is its effect on the coarse day-level risk.
  if (weatherCode > 70) {
    riskLevel = "high";
  }

  // The three original tips, in their original order and wording — the first
  // thing a returning user looks for. The first now escalates on any danger at
  // "high" or above, so an Extreme reading no longer falls through to the
  // milder "check the bulletins" line.
  const tips: string[] = [
    avalancheRisk === "high" || avalancheRisk === "extreme"
      ? "Avoid steep slopes and wind-loaded areas"
      : "Check local avalanche bulletins",
    windSpeed > 30
      ? "Strong winds - protect exposed skin"
      : "Moderate wind conditions",
    temp < -10
      ? "Extreme cold - risk of frostbite"
      : "Dress appropriately for temperature",
  ];

  // ---------------------------------------------------------------------------
  // Additions. Each appends a tip; none moves a threshold above.
  // ---------------------------------------------------------------------------

  const chill = windChill(temp, windSpeed);
  const chillApplies = windChillApplies(temp, windSpeed);
  if (chillApplies) {
    const exposure = exposureFromWindChill(chill);
    tips.push(
      `Feels like ${chill.toFixed(0)}°C in the wind — ${exposure.advice.toLowerCase()}`,
    );
  }

  const freezing = freezingLevelReading(
    atCurrentHour(weather.hourly?.freezing_level_height, now),
    weather.elevation,
  );
  if (freezing) tips.push(freezing.advice);

  const snow = snowDepthReading(atCurrentHour(weather.hourly?.snow_depth, now));
  // Bare ground is not worth a line; anything lying is.
  if (snow && snow.centimetres >= 1) {
    tips.push(`${Math.round(snow.centimetres)} cm lying — ${snow.advice}`);
  }

  const bands = ascentWindProfile(weather.current);
  const amplification = windAmplification(bands);
  if (amplification != null && amplification >= 1.5) {
    tips.push(
      `Wind is ${amplification.toFixed(1)}× stronger 120 m above the ground than at the surface — the valley reading is not telling you about the ridge.`,
    );
  }

  const gradient = [
    `Surface ${temp.toFixed(0)}°C`,
    weather.elevation != null
      ? `at ${Math.round(weather.elevation)} m`
      : "at model terrain height",
    chillApplies ? `feels like ${chill.toFixed(0)}°C` : null,
    "roughly -6.5°C per 1000 m of ascent",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    recommendation: `${avalancheRisk} avalanche risk, ${windExposure.toLowerCase()} wind exposure`,
    // A hand-assigned constant. Higher when the freezing level was available,
    // because that is the reading the rest of the picture hinges on.
    confidence: freezing ? 86 : 82,
    reasoning: [
      `Temperature: ${temp}°C`,
      `wind: ${windSpeed}km/h`,
      `weather code: ${weatherCode}`,
      freezing ? `freezing level ${Math.round(freezing.heightMetres)} m` : null,
      weather.elevation != null ? `terrain ${Math.round(weather.elevation)} m` : null,
    ]
      .filter(Boolean)
      .join(", "),
    riskLevel,
    profileSpecificTips: tips,
    avalancheRisk,
    visibilityForecast: weatherCode <= 3 ? "Good" : "Limited due to weather",
    windExposure,
    temperatureGradient: gradient,
  };
};
