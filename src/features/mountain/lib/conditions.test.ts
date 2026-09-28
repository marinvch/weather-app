import { describe, it, expect } from "vitest";
import {
  avalancheReading,
  avalancheRisk,
  avalancheThresholdDanger,
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

describe("the two avalanche calculations now agree", () => {
  /**
   * The predecessor of this block asserted the *disagreement* between the two
   * scorers, and said resolving the duplication should break it. It did.
   *
   * `avalancheReading` is now the single source of truth and both the tile and
   * `adviseMountain` derive from it, so what is pinned here is the agreement —
   * and the direction of the composition, which is that it takes the more
   * severe of the two and therefore never de-escalates a warning.
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

  it("reports the same level for the heavy-snow case that used to split them", () => {
    const conditions = {
      temperature_2m: -10,
      wind_speed_10m: 5,
      weather_code: 75,
    };

    // The two halves still disagree in isolation, and both are still exported
    // so that stays visible: points scores snow alone at 2, which is "Low",
    // while the threshold rule reads any code > 70 as "high".
    expect(avalancheRisk(-10, 5, 75).level).toBe("Low");
    expect(avalancheThresholdDanger(-10, 75)).toBe("high");

    // The reading composes them, and the advice card reads the composition —
    // so the tile and the card now say the same thing.
    expect(avalancheReading(-10, 5, 75).danger).toBe("high");
    expect(adviseMountain(forecast(conditions)).avalancheRisk).toBe("high");
  });

  it("takes the more severe half, so a warning is never de-escalated", () => {
    // Points high, threshold low: 1°C melt-freeze + 45 km/h wind + fresh snow
    // scores 7, which is "Extreme"; the threshold rule sees code 75 as "high".
    expect(avalancheRisk(1, 45, 75).level).toBe("Extreme");
    expect(avalancheThresholdDanger(1, 75)).toBe("high");
    expect(avalancheReading(1, 45, 75).danger).toBe("extreme");

    // And the reverse: threshold high, points Low.
    expect(avalancheRisk(20, 5, 95).level).toBe("Low");
    expect(avalancheThresholdDanger(20, 95)).toBe("high");
    expect(avalancheReading(20, 5, 95).danger).toBe("high");
  });

  it("agrees with both halves when they already agree", () => {
    expect(avalancheReading(-10, 5, 0).danger).toBe("low");
    expect(avalancheReading(1, 5, 0).danger).toBe("moderate");
  });

  /**
   * "considerable" is EADS level 3 and neither scorer can produce it — the
   * points bands are spelled Low/Moderate/High/Extreme and the threshold rule
   * emits only low/moderate/high. Pinned so that a future scorer which *can*
   * reach it has to do so deliberately.
   */
  it("never produces the EADS 'considerable' band from either scorer", () => {
    const cases: [number, number, number][] = [
      [-20, 0, 0], [-1, 70, 75], [1, 45, 75], [20, 5, 95], [3, 30, 63],
    ];
    for (const [t, w, c] of cases) {
      expect(avalancheReading(t, w, c).danger).not.toBe("considerable");
    }
  });
});
