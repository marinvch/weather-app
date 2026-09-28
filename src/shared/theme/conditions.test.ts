import { describe, it, expect } from "vitest";
import {
  conditionFromCode,
  skyGradient,
  type ConditionGroup,
} from "./conditions";

/**
 * Every code Open-Meteo can emit, with the group it must land in. Written out
 * rather than derived from the table under test — a test that reuses the
 * implementation's own map only proves the map equals itself.
 */
const EXPECTED: Array<[number, ConditionGroup]> = [
  [0, "clear"],
  [1, "clear"],
  [2, "cloud"],
  [3, "cloud"],
  [45, "fog"],
  [48, "fog"],
  [51, "drizzle"],
  [53, "drizzle"],
  [55, "drizzle"],
  [56, "drizzle"],
  [57, "drizzle"],
  [61, "rain"],
  [63, "rain"],
  [65, "rain"],
  [66, "rain"],
  [67, "rain"],
  [71, "snow"],
  [73, "snow"],
  [75, "snow"],
  [77, "snow"],
  [80, "rain"],
  [81, "rain"],
  [82, "rain"],
  [85, "snow"],
  [86, "snow"],
  [95, "thunder"],
  [96, "thunder"],
  [99, "thunder"],
];

describe("conditionFromCode", () => {
  it.each(EXPECTED)("maps code %i to the %s group", (code, group) => {
    const info = conditionFromCode(code);
    expect(info.group).toBe(group);
    expect(info.code).toBe(code);
  });

  it("gives every known code a non-empty label", () => {
    for (const [code] of EXPECTED) {
      expect(conditionFromCode(code).label).not.toBe("");
      expect(conditionFromCode(code).label).not.toBe("Unknown conditions");
    }
  });

  it("keeps every severity inside the 0-3 scale", () => {
    for (const [code] of EXPECTED) {
      const { severity } = conditionFromCode(code);
      expect(severity).toBeGreaterThanOrEqual(0);
      expect(severity).toBeLessThanOrEqual(3);
    }
  });

  it("grades a clear sky benign and a hailstorm hazardous", () => {
    expect(conditionFromCode(0).severity).toBe(0);
    expect(conditionFromCode(99).severity).toBe(3);
  });

  it("grades intensity monotonically within a family", () => {
    // Slight, moderate, heavy rain: the labels are ordered, so the severities
    // must be too, or a worsening forecast renders calmer than the one before.
    expect(conditionFromCode(61).severity).toBeLessThan(
      conditionFromCode(63).severity,
    );
    expect(conditionFromCode(63).severity).toBeLessThan(
      conditionFromCode(65).severity,
    );
    expect(conditionFromCode(71).severity).toBeLessThan(
      conditionFromCode(75).severity,
    );
    expect(conditionFromCode(80).severity).toBeLessThan(
      conditionFromCode(82).severity,
    );
  });

  it("treats freezing precipitation as hazardous however light it is", () => {
    // 66 is "light freezing rain" and must still outrank plain heavy rain's
    // neighbours — it is the ice that closes the road, not the rate.
    expect(conditionFromCode(66).severity).toBe(3);
    expect(conditionFromCode(57).severity).toBe(3);
    expect(conditionFromCode(56).severity).toBeGreaterThan(
      conditionFromCode(51).severity,
    );
  });

  it.each([4, 7, 42, 100, -1, 999, 62.5])(
    "falls back safely for the unmapped code %s",
    (code) => {
      const info = conditionFromCode(code);
      expect(info).toEqual({
        code,
        label: "Unknown conditions",
        group: "cloud",
        severity: 1,
      });
    },
  );

  it("never reports an unreadable code as benign", () => {
    // The fallback deliberately is not severity 0: an unknown code is not
    // evidence of a calm sky, and "benign" is the misreading that gets someone
    // caught out.
    expect(conditionFromCode(4).severity).not.toBe(0);
  });

  it("survives NaN rather than throwing at the render", () => {
    expect(conditionFromCode(Number.NaN).label).toBe("Unknown conditions");
  });
});

describe("skyGradient", () => {
  it("returns a CSS gradient for every known code, day and night", () => {
    for (const [code] of EXPECTED) {
      for (const isDay of [true, false]) {
        const gradient = skyGradient(code, isDay);
        expect(gradient).toMatch(/^linear-gradient\(160deg, #[0-9A-Fa-f]{6} 0%, #[0-9A-Fa-f]{6} 100%\)$/);
      }
    }
  });

  it("gives a clear noon and a clear night different pictures", () => {
    expect(skyGradient(0, true)).not.toBe(skyGradient(0, false));
  });

  it("falls back to the cloud gradient for an unknown code", () => {
    expect(skyGradient(4, true)).toBe(skyGradient(2, true));
  });
});
