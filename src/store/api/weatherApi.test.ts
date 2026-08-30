import { describe, it, expect } from "vitest";
import {
  generateGeneralAnalysis,
  generateMountainAnalysis,
} from "./weatherApi";
import type { CurrentWeather, WeatherResponse } from "../../types/weather";

/**
 * These two are pure functions from a WeatherResponse to an analysis — no
 * network, no store. They are the app's entire "AI": rule-based thresholds with
 * hard-coded confidence values. Testing them directly is the point; going
 * through RTK Query would test fetch instead.
 */
function response(current: Partial<CurrentWeather> | null): WeatherResponse {
  return {
    latitude: 42.7,
    longitude: 27.27,
    timezone: "Europe/Sofia",
    timezone_abbreviation: "EET",
    utc_offset_seconds: 7200,
    current: current
      ? ({
          time: "2026-08-30T12:00",
          temperature_2m: 20,
          relative_humidity_2m: 50,
          wind_speed_10m: 5,
          wind_direction_10m: 180,
          weather_code: 0,
          is_day: 1,
          ...current,
        } as CurrentWeather)
      : undefined,
  };
}

describe("generateGeneralAnalysis", () => {
  it("reports zero confidence when there is no current weather", () => {
    const analysis = generateGeneralAnalysis(response(null));

    expect(analysis.confidence).toBe(0);
    expect(analysis.recommendation).toBe("Weather data unavailable");
    expect(analysis.profileSpecificTips).toEqual([]);
  });

  it("calls warm, calm, clear weather low risk", () => {
    const analysis = generateGeneralAnalysis(
      response({ temperature_2m: 27, wind_speed_10m: 5, weather_code: 0 }),
    );

    expect(analysis.riskLevel).toBe("low");
    expect(analysis.recommendation).toContain("outdoor activities");
    expect(analysis.profileSpecificTips).toContain(
      "Stay hydrated and use sun protection",
    );
  });

  it("raises risk to medium below 5°C", () => {
    const analysis = generateGeneralAnalysis(
      response({ temperature_2m: 2, wind_speed_10m: 5 }),
    );

    expect(analysis.riskLevel).toBe("medium");
    expect(analysis.recommendation).toContain("Cold weather");
  });

  it("raises risk to medium above 20 km/h of wind", () => {
    const analysis = generateGeneralAnalysis(
      response({ temperature_2m: 18, wind_speed_10m: 25 }),
    );

    expect(analysis.riskLevel).toBe("medium");
    expect(analysis.recommendation).toContain("Strong winds");
  });

  it("treats snow codes (71-75) as high risk", () => {
    const analysis = generateGeneralAnalysis(
      response({ temperature_2m: -2, weather_code: 73 }),
    );

    expect(analysis.riskLevel).toBe("high");
  });

  it("mentions rain for codes 61-65 without escalating past low risk", () => {
    const analysis = generateGeneralAnalysis(
      response({ temperature_2m: 15, wind_speed_10m: 5, weather_code: 63 }),
    );

    expect(analysis.recommendation).toContain("Rain expected");
    expect(analysis.riskLevel).toBe("low");
  });

  it("reports a fixed 85 confidence whenever data is present", () => {
    // The confidence is a constant, not a computed certainty. Asserting it
    // pins that down so nobody reads the number as meaningful.
    expect(generateGeneralAnalysis(response({})).confidence).toBe(85);
    expect(
      generateGeneralAnalysis(response({ temperature_2m: -30 })).confidence,
    ).toBe(85);
  });
});

describe("generateMountainAnalysis", () => {
  it("returns the unavailable shape, with mountain fields, when there is no current weather", () => {
    const analysis = generateMountainAnalysis(response(null));

    expect(analysis.confidence).toBe(0);
    expect(analysis.avalancheRisk).toBe("low");
    expect(analysis.visibilityForecast).toBe("Unknown");
  });

  it("flags moderate avalanche risk in the 0-3°C melt-freeze band", () => {
    const analysis = generateMountainAnalysis(
      response({ temperature_2m: 1, wind_speed_10m: 5, weather_code: 0 }),
    );

    expect(analysis.avalancheRisk).toBe("moderate");
    expect(analysis.riskLevel).toBe("medium");
  });

  it("does not flag that band at exactly 0°C or 3°C — the bounds are exclusive", () => {
    expect(
      generateMountainAnalysis(response({ temperature_2m: 0 })).avalancheRisk,
    ).toBe("low");
    expect(
      generateMountainAnalysis(response({ temperature_2m: 3 })).avalancheRisk,
    ).toBe("low");
  });

  it("escalates wind exposure across the 15/25/40 km/h thresholds", () => {
    const at = (wind: number) =>
      generateMountainAnalysis(response({ wind_speed_10m: wind }));

    expect(at(10).windExposure).toBe("Mild");
    expect(at(20).windExposure).toBe("Moderate");
    expect(at(30).windExposure).toBe("High");
    expect(at(30).riskLevel).toBe("medium");
    expect(at(50).windExposure).toBe("Extreme");
    expect(at(50).riskLevel).toBe("high");
  });

  it("treats any code above 70 as high avalanche risk", () => {
    const analysis = generateMountainAnalysis(
      response({ temperature_2m: -5, weather_code: 75 }),
    );

    expect(analysis.avalancheRisk).toBe("high");
    expect(analysis.riskLevel).toBe("high");
    expect(analysis.profileSpecificTips).toContain(
      "Avoid steep slopes and wind-loaded areas",
    );
  });

  it("also treats thunderstorm codes (95-99) as high avalanche risk", () => {
    // > 70 catches thunderstorms too, which is unlikely to be intended but is
    // the current behaviour. Pinned so a fix is a deliberate change.
    const analysis = generateMountainAnalysis(response({ weather_code: 95 }));

    expect(analysis.avalancheRisk).toBe("high");
  });

  it("reports limited visibility for anything past code 3", () => {
    expect(
      generateMountainAnalysis(response({ weather_code: 3 }))
        .visibilityForecast,
    ).toBe("Good");
    expect(
      generateMountainAnalysis(response({ weather_code: 45 }))
        .visibilityForecast,
    ).toBe("Limited due to weather");
  });

  it("warns about frostbite below -10°C", () => {
    const analysis = generateMountainAnalysis(
      response({ temperature_2m: -15 }),
    );

    expect(analysis.profileSpecificTips).toContain(
      "Extreme cold - risk of frostbite",
    );
  });
});
