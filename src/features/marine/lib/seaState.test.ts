import { describe, expect, it } from "vitest";
import {
  beaufortFromKmh,
  beaufortLowerBoundKnots,
  douglasFromWaveHeight,
  swellSeparation,
  waterTemperatureReading,
} from "./seaState";

/**
 * Douglas and Beaufort are published scales, so every boundary is tested from
 * both sides. A threshold moving here changes what "force 8" means to someone
 * deciding whether to put to sea — it is not a tuning value, and a test that
 * only checked the middle of each band would not notice it move.
 */
describe("douglasFromWaveHeight", () => {
  it.each([
    [0, 0],
    [0.05, 1],
    [0.0999, 1],
    [0.1, 2],
    [0.49, 2],
    [0.5, 3],
    [1.24, 3],
    [1.25, 4],
    [2.49, 4],
    [2.5, 5],
    [3.99, 5],
    [4, 6],
    [5.99, 6],
    [6, 7],
    [8.99, 7],
    [9, 8],
    [13.99, 8],
    [14, 9],
    [30, 9],
  ])("reads %s m as degree %i", (metres, degree) => {
    expect(douglasFromWaveHeight(metres)?.degree).toBe(degree);
  });

  it("keeps a glassy calm distinct from a rippled one", () => {
    expect(douglasFromWaveHeight(0)?.label).toBe("Calm (glassy)");
    expect(douglasFromWaveHeight(0.01)?.label).toBe("Calm (rippled)");
  });

  it("maps the degrees onto the four-step display scale", () => {
    expect(douglasFromWaveHeight(0.3)?.risk).toBe("low");
    expect(douglasFromWaveHeight(1.5)?.risk).toBe("moderate");
    expect(douglasFromWaveHeight(3)?.risk).toBe("high");
    expect(douglasFromWaveHeight(7)?.risk).toBe("severe");
  });

  /**
   * The reason this returns `null` rather than degree 0: the marine host
   * answers an inland coordinate with a series of nulls and HTTP 200. Reading
   * that as "calm" tells someone the sea is flat where there is no sea.
   */
  it.each([[null], [undefined], [Number.NaN], [-0.5]])(
    "answers null for %s rather than calling it calm",
    (value) => {
      expect(douglasFromWaveHeight(value as number | null)).toBeNull();
    },
  );
});

describe("beaufortFromKmh", () => {
  /**
   * The scale is defined in knots, so the boundaries are stated in knots and
   * converted with the exact factor (1 kn = 1.852 km/h) to get the km/h input.
   * `- 0.01` sits just below a boundary, `+ 0` on it.
   */
  const KNOT_BOUNDS = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
  const toKmh = (knots: number) => knots * 1.852;

  it.each(KNOT_BOUNDS.map((kn, i) => [kn, i + 1] as const))(
    "steps up to force %i at %s knots",
    (knots, force) => {
      expect(beaufortFromKmh(toKmh(knots))?.force).toBe(force);
      expect(beaufortFromKmh(toKmh(knots) - 0.01)?.force).toBe(force - 1);
    },
  );

  it("reads a dead calm as force 0", () => {
    expect(beaufortFromKmh(0)).toMatchObject({ force: 0, label: "Calm" });
  });

  it("has no ceiling above force 12", () => {
    expect(beaufortFromKmh(400)?.force).toBe(12);
  });

  it("names the forces the way the scale does", () => {
    expect(beaufortFromKmh(toKmh(30))?.label).toBe("Near gale");
    expect(beaufortFromKmh(toKmh(36))?.label).toBe("Gale");
    expect(beaufortFromKmh(toKmh(70))?.label).toBe("Hurricane force");
  });

  it("escalates risk at the small-craft and gale thresholds", () => {
    expect(beaufortFromKmh(toKmh(10))?.risk).toBe("low"); // force 3
    expect(beaufortFromKmh(toKmh(14))?.risk).toBe("moderate"); // force 4
    expect(beaufortFromKmh(toKmh(24))?.risk).toBe("high"); // force 6
    expect(beaufortFromKmh(toKmh(36))?.risk).toBe("severe"); // force 8
  });

  it.each([[null], [undefined], [Number.NaN], [-3]])(
    "answers null for %s rather than calling it calm",
    (value) => {
      expect(beaufortFromKmh(value as number | null)).toBeNull();
    },
  );

  it("exposes each force's lower bound in knots", () => {
    expect(beaufortLowerBoundKnots(0)).toBe(0);
    expect(beaufortLowerBoundKnots(8)).toBe(34);
    expect(beaufortLowerBoundKnots(12)).toBe(64);
  });
});

describe("swellSeparation", () => {
  it("calls a sea swell-dominated at or above a 65% share", () => {
    expect(swellSeparation(1.3, 0.7)?.composition).toBe("swell-dominated");
    expect(swellSeparation(0.65, 0.35)?.swellShare).toBeCloseTo(0.65);
    expect(swellSeparation(0.65, 0.35)?.composition).toBe("swell-dominated");
  });

  it("calls it wind-dominated at or below a 35% share", () => {
    expect(swellSeparation(0.35, 0.65)?.composition).toBe("wind-dominated");
    expect(swellSeparation(0.2, 1.4)?.composition).toBe("wind-dominated");
  });

  it("calls the band between them mixed", () => {
    expect(swellSeparation(1, 1)?.composition).toBe("mixed");
    expect(swellSeparation(0.36, 0.64)?.composition).toBe("mixed");
    expect(swellSeparation(0.64, 0.36)?.composition).toBe("mixed");
  });

  it("reports a flat sea without dividing by zero", () => {
    const flat = swellSeparation(0, 0);
    expect(flat?.swellShare).toBe(0);
    expect(flat?.composition).toBe("mixed");
    expect(flat?.description).toMatch(/Flat/);
  });

  it("answers null when either component is missing", () => {
    expect(swellSeparation(null, 1)).toBeNull();
    expect(swellSeparation(1, null)).toBeNull();
    expect(swellSeparation(-1, 1)).toBeNull();
  });
});

describe("waterTemperatureReading", () => {
  it.each([
    [1, "Near freezing", "severe"],
    [4.99, "Near freezing", "severe"],
    [5, "Very cold", "high"],
    [9.99, "Very cold", "high"],
    [10, "Cold", "moderate"],
    [14.99, "Cold", "moderate"],
    [15, "Cool", "low"],
    [19.99, "Cool", "low"],
    [20, "Mild", "low"],
    [28, "Mild", "low"],
  ])("reads %s°C as %s", (celsius, text, risk) => {
    expect(waterTemperatureReading(celsius)).toMatchObject({ text, risk });
  });

  it("answers null rather than inventing a band", () => {
    expect(waterTemperatureReading(null)).toBeNull();
    expect(waterTemperatureReading(Number.NaN)).toBeNull();
  });
});
