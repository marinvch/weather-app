import { describe, it, expect } from "vitest";
import {
  avalancheRisk,
  visibilityCondition,
  windCondition,
} from "./conditions";
import { adviseMountain } from "./advice";
import type { CurrentWeather, WeatherResponse } from "@/shared/types/weather";

describe("windCondition", () => {
  it.each([
    [0, "Calm"],
    [19, "Calm"],
    [20, "Breezy"],
    [39, "Breezy"],
    [40, "Windy"],
    [59, "Windy"],
    [60, "Dangerous"],
  ])("reads %i km/h as %s", (speed, text) => {
    expect(windCondition(speed).text).toBe(text);
  });
});

describe("visibilityCondition", () => {
  it("names fog as the cause of poor visibility", () => {
    expect(visibilityCondition(45)).toMatchObject({
      text: "Poor",
      cause: "Fog",
    });
  });

  it("treats rain as reduced rather than poor", () => {
    expect(visibilityCondition(63)).toMatchObject({
      text: "Reduced",
      cause: "Rain",
    });
  });

  it("treats snow as poor", () => {
    expect(visibilityCondition(75)).toMatchObject({
      text: "Poor",
      cause: "Snow",
    });
  });

  it("reports good visibility for a clear sky", () => {
    expect(visibilityCondition(0).text).toBe("Good");
  });

  it("reports good visibility for a thunderstorm, which is a gap", () => {
    // Codes 95-99 are in none of the lists, so a thunderstorm reads as clear.
    // Pinned as current behaviour, not endorsed.
    expect(visibilityCondition(95).text).toBe("Good");
  });
});

describe("avalancheRisk", () => {
  it("is low in cold, calm, clear conditions", () => {
    expect(avalancheRisk(-10, 5, 0).level).toBe("Low");
  });

  it("rises through the melt-freeze band", () => {
    // -2 < temp < 2 adds 2; above freezing adds 1 more.
    expect(avalancheRisk(1, 5, 0).level).toBe("Moderate");
  });

  it("counts wind loading", () => {
    expect(avalancheRisk(-10, 45, 0).level).toBe("Low");
    expect(avalancheRisk(-10, 65, 0).level).toBe("Moderate");
  });

  it("counts fresh snow", () => {
    expect(avalancheRisk(-10, 5, 75).level).toBe("Low");
    expect(avalancheRisk(1, 45, 75).level).toBe("Extreme");
  });

  it("counts rain on snow only below 5°C", () => {
    // Wind alone at 45 km/h scores 2, the top of the "Low" band. Adding rain
    // below 5°C pushes it over; the same rain above 5°C does not count.
    expect(avalancheRisk(-10, 45, 0).level).toBe("Low");
    expect(avalancheRisk(-10, 45, 63).level).toBe("Moderate");
    expect(avalancheRisk(10, 45, 63).level).toBe("Moderate"); // via temp > 0
    expect(avalancheRisk(10, 5, 63).level).toBe("Low");
  });
});

describe("the two avalanche calculations disagree", () => {
  /**
   * This test exists to make the conflict visible and to fail loudly if
   * somebody "fixes" one side without the other. It asserts the disagreement,
   * so resolving the duplication SHOULD break it — at which point delete it.
   */
  function forecast(current: Partial<CurrentWeather>): WeatherResponse {
    return {
      latitude: 45.9,
      longitude: 6.87,
      timezone: "Europe/Paris",
      timezone_abbreviation: "CET",
      utc_offset_seconds: 3600,
      current: {
        time: "2026-08-30T12:00",
        temperature_2m: 20,
        relative_humidity_2m: 50,
        wind_speed_10m: 5,
        wind_direction_10m: 180,
        weather_code: 0,
        is_day: 1,
        ...current,
      } as CurrentWeather,
    };
  }

  it("reports different levels for the same heavy-snow conditions", () => {
    const conditions = {
      temperature_2m: -10,
      wind_speed_10m: 5,
      weather_code: 75,
    };

    // Threshold-based: any code > 70 is "high".
    expect(adviseMountain(forecast(conditions)).avalancheRisk).toBe("high");
    // Points-based: snow alone scores 2, which is still "Low".
    expect(avalancheRisk(-10, 5, 75).level).toBe("Low");
  });
});
