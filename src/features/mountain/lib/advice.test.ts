import { describe, it, expect } from "vitest";
import { adviseMountain } from "./advice";
import type { CurrentWeather, WeatherResponse } from "@/shared/types/weather";

/**
 * adviseMountain is a pure function from a forecast to ascent advice — no
 * network, no store. Tested directly; going through RTK Query would test fetch.
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

describe("adviseMountain", () => {
  it("returns the unavailable shape, with mountain fields, when there is no current weather", () => {
    const analysis = adviseMountain(response(null));

    expect(analysis.confidence).toBe(0);
    expect(analysis.avalancheRisk).toBe("low");
    expect(analysis.visibilityForecast).toBe("Unknown");
  });

  it("flags moderate avalanche risk in the 0-3°C melt-freeze band", () => {
    const analysis = adviseMountain(
      response({ temperature_2m: 1, wind_speed_10m: 5, weather_code: 0 }),
    );

    expect(analysis.avalancheRisk).toBe("moderate");
    expect(analysis.riskLevel).toBe("medium");
  });

  it("does not flag that band at exactly 0°C or 3°C — the bounds are exclusive", () => {
    expect(
      adviseMountain(response({ temperature_2m: 0 })).avalancheRisk,
    ).toBe("low");
    expect(
      adviseMountain(response({ temperature_2m: 3 })).avalancheRisk,
    ).toBe("low");
  });

  it("escalates wind exposure across the 15/25/40 km/h thresholds", () => {
    const at = (wind: number) =>
      adviseMountain(response({ wind_speed_10m: wind }));

    expect(at(10).windExposure).toBe("Mild");
    expect(at(20).windExposure).toBe("Moderate");
    expect(at(30).windExposure).toBe("High");
    expect(at(30).riskLevel).toBe("medium");
    expect(at(50).windExposure).toBe("Extreme");
    expect(at(50).riskLevel).toBe("high");
  });

  it("treats any code above 70 as high avalanche risk", () => {
    const analysis = adviseMountain(
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
    const analysis = adviseMountain(response({ weather_code: 95 }));

    expect(analysis.avalancheRisk).toBe("high");
  });

  it("reports limited visibility for anything past code 3", () => {
    expect(
      adviseMountain(response({ weather_code: 3 }))
        .visibilityForecast,
    ).toBe("Good");
    expect(
      adviseMountain(response({ weather_code: 45 }))
        .visibilityForecast,
    ).toBe("Limited due to weather");
  });

  it("warns about frostbite below -10°C", () => {
    const analysis = adviseMountain(
      response({ temperature_2m: -15 }),
    );

    expect(analysis.profileSpecificTips).toContain(
      "Extreme cold - risk of frostbite",
    );
  });
});
