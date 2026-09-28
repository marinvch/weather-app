import { describe, expect, it } from "vitest";
import {
  ascentWindProfile,
  exposureFromWindChill,
  freezingLevelReading,
  snowDepthReading,
  windAmplification,
  windChill,
  windChillApplies,
} from "./conditions";

/**
 * The altitude half of the mountain feature — wind chill, freezing level, snow
 * depth and the ascent profile.
 *
 * Separate file from `conditions.test.ts` so the pinned disagreement between
 * the two avalanche calculations stays readable on its own. These are the
 * additions; that file is the archaeology.
 */

describe("windChill", () => {
  /**
   * Reference values from the Environment Canada / NWS wind chill chart, which
   * is what the JAG/TI formula was published alongside. Within half a degree,
   * because the published chart is itself rounded to whole degrees.
   */
  it.each([
    [0, 10, -3],
    [0, 30, -6],
    [-10, 20, -18],
    [-20, 40, -34],
    [-30, 60, -50],
    [10, 10, 9],
  ])("chills %s°C in %s km/h to about %s°C", (temp, wind, expected) => {
    expect(windChill(temp, wind)).toBeCloseTo(expected, 0);
  });

  /**
   * The formula is undefined above 10°C and below 4.8 km/h, where it produces a
   * "chill" warmer than the air. Returning the air temperature is the honest
   * answer; inventing a number there is how a screen tells someone it feels
   * warmer than it does.
   */
  it("returns the air temperature outside the formula's domain", () => {
    expect(windChill(15, 30)).toBe(15);
    expect(windChill(-5, 3)).toBe(-5);
    expect(windChill(-5, 4.8)).toBe(-5);
  });

  it("applies just past the 4.8 km/h and 10°C bounds", () => {
    expect(windChillApplies(10, 4.81)).toBe(true);
    expect(windChillApplies(10.01, 30)).toBe(false);
    expect(windChillApplies(-5, 4.8)).toBe(false);
  });

  it("passes a non-finite reading straight through rather than producing NaN", () => {
    expect(windChill(Number.NaN, 20)).toBeNaN();
    expect(windChill(-5, Number.NaN)).toBe(-5);
  });
});

describe("exposureFromWindChill", () => {
  // The expected words are this feature's own `Severity` — "medium" and
  // "extreme" — not the shared `RiskLevel`'s "moderate" and "severe". The two
  // scales have four steps each and different vocabularies; conversion happens
  // at the display boundary, through a named record.
  it.each([
    [0, "low"],
    [-9.99, "low"],
    [-10, "medium"],
    [-27.99, "medium"],
    [-28, "high"],
    [-37.99, "high"],
    [-38, "extreme"],
    [-47.99, "extreme"],
    [-48, "extreme"],
  ])("grades a %s°C chill as %s", (chill, severity) => {
    expect(exposureFromWindChill(chill).severity).toBe(severity);
  });

  it("names the frostbite time, which is the number that decides the day", () => {
    expect(exposureFromWindChill(-30).text).toMatch(/10 to 30 minutes/);
    expect(exposureFromWindChill(-50).text).toMatch(/under 2 minutes/);
  });

  it("does not claim low risk for an unreadable value", () => {
    expect(exposureFromWindChill(Number.NaN).severity).not.toBe("low");
  });
});

describe("freezingLevelReading", () => {
  it("reports a freezing level below the terrain as frozen ground", () => {
    const reading = freezingLevelReading(1200, 1800);
    expect(reading?.aboveTerrainMetres).toBe(-600);
    expect(reading?.text).toBe("Below the ground here");
    expect(reading?.severity).toBe("high");
  });

  it("treats exactly at the terrain height as below it", () => {
    expect(freezingLevelReading(1800, 1800)?.severity).toBe("high");
  });

  it.each([
    [1801, "high"],
    [2300, "high"],
    [2301, "medium"],
    [3300, "medium"],
    [3301, "low"],
  ])(
    "grades a freezing level at %s m over 1800 m terrain as %s",
    (freezing, severity) => {
      expect(freezingLevelReading(freezing, 1800)?.severity).toBe(severity);
    },
  );

  it("warns hardest about the dangerous middle, where the level cuts the route", () => {
    expect(freezingLevelReading(2000, 1800)?.advice).toMatch(/wet-slab/);
  });

  it("answers null when either height is missing", () => {
    expect(freezingLevelReading(null, 1800)).toBeNull();
    expect(freezingLevelReading(2000, undefined)).toBeNull();
    expect(freezingLevelReading(Number.NaN, 1800)).toBeNull();
  });
});

describe("snowDepthReading", () => {
  /**
   * Open-Meteo's `snow_depth` is **metres**. Reading 0.4 as centimetres would
   * report 40 cm of snow as "0.4 cm" — no snow at all — which is the same shape
   * of bug as the soil-moisture one in the agriculture feature.
   */
  it("converts metres to centimetres", () => {
    expect(snowDepthReading(0.4)?.centimetres).toBeCloseTo(40);
    expect(snowDepthReading(1.2)?.centimetres).toBeCloseTo(120);
  });

  it.each([
    [0, "Bare ground", "low"],
    [0.009, "Bare ground", "low"],
    [0.01, "Thin cover", "low"],
    [0.299, "Thin cover", "low"],
    [0.3, "Established snowpack", "medium"],
    [0.799, "Established snowpack", "medium"],
    [0.8, "Deep snowpack", "high"],
    [1.999, "Deep snowpack", "high"],
    [2, "Very deep snowpack", "extreme"],
  ])("reads %s m as %s", (metres, text, severity) => {
    expect(snowDepthReading(metres)).toMatchObject({ text, severity });
  });

  it("answers null for a missing or impossible reading", () => {
    expect(snowDepthReading(null)).toBeNull();
    expect(snowDepthReading(-0.1)).toBeNull();
    expect(snowDepthReading(Number.NaN)).toBeNull();
  });
});

describe("ascentWindProfile", () => {
  it("returns the three levels in ascending order", () => {
    const bands = ascentWindProfile({
      wind_speed_10m: 12,
      wind_speed_80m: 25,
      wind_speed_120m: 44,
    });

    expect(bands.map((b) => b.heightAgl)).toEqual([10, 80, 120]);
    expect(bands.map((b) => b.condition?.text)).toEqual([
      "Calm",
      "Breezy",
      "Windy",
    ]);
  });

  /**
   * A level Open-Meteo did not return must not render as calm. The 80 m and
   * 120 m winds are genuinely absent over some terrain.
   */
  it("keeps a missing level distinct from a calm one", () => {
    const bands = ascentWindProfile({ wind_speed_10m: 0 });

    expect(bands[0].speedKmh).toBe(0);
    expect(bands[0].condition?.text).toBe("Calm");
    expect(bands[2].speedKmh).toBeNull();
    expect(bands[2].condition).toBeNull();
  });
});

describe("windAmplification", () => {
  it("reports the ratio of the highest reported level to the surface", () => {
    expect(
      windAmplification(
        ascentWindProfile({
          wind_speed_10m: 20,
          wind_speed_80m: 30,
          wind_speed_120m: 50,
        }),
      ),
    ).toBeCloseTo(2.5);
  });

  it("falls back to 80 m when 120 m is missing", () => {
    expect(
      windAmplification(
        ascentWindProfile({ wind_speed_10m: 10, wind_speed_80m: 25 }),
      ),
    ).toBeCloseTo(2.5);
  });

  /**
   * Below 5 km/h at the surface the ratio is arithmetic noise — 1 km/h against
   * 6 km/h is "six times the wind" and warns about nothing.
   */
  it("declines to report a ratio off a near-calm surface reading", () => {
    expect(
      windAmplification(
        ascentWindProfile({ wind_speed_10m: 1, wind_speed_120m: 6 }),
      ),
    ).toBeNull();
  });

  it("answers null with no upper level at all", () => {
    expect(windAmplification(ascentWindProfile({ wind_speed_10m: 20 }))).toBeNull();
  });
});
