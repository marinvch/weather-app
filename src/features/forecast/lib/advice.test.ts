import { describe, it, expect } from "vitest";
import { adviseGeneral } from "./advice";
import type { CurrentWeather, WeatherResponse } from '@/shared/types/weather';

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

describe("adviseGeneral", () => {
  it("reports zero confidence when there is no current weather", () => {
    const analysis = adviseGeneral(response(null));

    expect(analysis.confidence).toBe(0);
    expect(analysis.recommendation).toBe("Weather data unavailable");
    expect(analysis.profileSpecificTips).toEqual([]);
  });

  it("calls warm, calm, clear weather low risk", () => {
    const analysis = adviseGeneral(
      response({ temperature_2m: 27, wind_speed_10m: 5, weather_code: 0 }),
    );

    expect(analysis.riskLevel).toBe("low");
    expect(analysis.recommendation).toContain("outdoor activities");
    expect(analysis.profileSpecificTips).toContain(
      "Stay hydrated and use sun protection",
    );
  });

  it("raises risk to medium below 5°C", () => {
    const analysis = adviseGeneral(
      response({ temperature_2m: 2, wind_speed_10m: 5 }),
    );

    expect(analysis.riskLevel).toBe("medium");
    expect(analysis.recommendation).toContain("Cold weather");
  });

  it("raises risk to medium above 20 km/h of wind", () => {
    const analysis = adviseGeneral(
      response({ temperature_2m: 18, wind_speed_10m: 25 }),
    );

    expect(analysis.riskLevel).toBe("medium");
    expect(analysis.recommendation).toContain("Strong winds");
  });

  it("treats snow codes (71-75) as high risk", () => {
    const analysis = adviseGeneral(
      response({ temperature_2m: -2, weather_code: 73 }),
    );

    expect(analysis.riskLevel).toBe("high");
  });

  it("mentions rain for codes 61-65 without escalating past low risk", () => {
    const analysis = adviseGeneral(
      response({ temperature_2m: 15, wind_speed_10m: 5, weather_code: 63 }),
    );

    expect(analysis.recommendation).toContain("Rain expected");
    expect(analysis.riskLevel).toBe("low");
  });

  it("reports a fixed 85 confidence whenever data is present", () => {
    // The confidence is a constant, not a computed certainty. Asserting it
    // pins that down so nobody reads the number as meaningful.
    expect(adviseGeneral(response({})).confidence).toBe(85);
    expect(
      adviseGeneral(response({ temperature_2m: -30 })).confidence,
    ).toBe(85);
  });
});
