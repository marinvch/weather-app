import { describe, expect, it } from "vitest";
import { assessSprayConditions, findSprayWindows } from "./spray";

/** A textbook spray hour: light breeze, dry, moderate humidity, mild. */
const IDEAL = {
  windSpeedKmh: 8,
  precipitationProbability: 5,
  relativeHumidity: 60,
  temperatureC: 18,
};

describe("assessSprayConditions — the clean case", () => {
  it("says go, and still defers to the label", () => {
    const result = assessSprayConditions(IDEAL);
    expect(result.verdict).toBe("go");
    expect(result.risk).toBe("low");
    expect(result.reasons).toEqual([]);
    expect(result.summary).toMatch(/label still has the final word/);
  });
});

describe("assessSprayConditions — wind", () => {
  it.each([
    [0, "caution"], // inversion risk
    [1.9, "caution"],
    [2, "go"],
    [15, "go"],
    [15.1, "caution"],
    [20, "caution"],
    [20.1, "no-go"],
    [40, "no-go"],
  ])("reads %s km/h as %s", (windSpeedKmh, verdict) => {
    expect(assessSprayConditions({ ...IDEAL, windSpeedKmh }).verdict).toBe(verdict);
  });

  /**
   * The counter-intuitive half of the rule: dead calm is a drift hazard, not
   * the ideal condition it is usually assumed to be. Under an inversion, fine
   * droplets stay suspended and then move a long way sideways.
   */
  it("explains why near-calm is a caution rather than the best case", () => {
    const result = assessSprayConditions({ ...IDEAL, windSpeedKmh: 0.5 });
    expect(result.reasons.join(" ")).toMatch(/inversion/);
  });
});

describe("assessSprayConditions — rain, humidity and temperature", () => {
  it.each([
    [0, "go"],
    [30, "go"],
    [30.1, "caution"],
    [60, "caution"],
    [60.1, "no-go"],
  ])("reads a %s%% chance of rain as %s", (precipitationProbability, verdict) => {
    expect(
      assessSprayConditions({ ...IDEAL, precipitationProbability }).verdict,
    ).toBe(verdict);
  });

  it.each([
    [39.9, "caution"], // evaporation
    [40, "go"],
    [95, "go"],
    [95.1, "caution"], // slow drying / inversion
  ])("reads %s%% humidity as %s", (relativeHumidity, verdict) => {
    expect(assessSprayConditions({ ...IDEAL, relativeHumidity }).verdict).toBe(
      verdict,
    );
  });

  it("warns about evaporation at low humidity, not just about drift", () => {
    expect(
      assessSprayConditions({ ...IDEAL, relativeHumidity: 25 }).reasons.join(" "),
    ).toMatch(/evaporate/);
  });

  it.each([
    [28, "go"],
    [28.1, "caution"],
    [32, "caution"],
    [32.1, "no-go"],
  ])("reads %s°C as %s", (temperatureC, verdict) => {
    expect(assessSprayConditions({ ...IDEAL, temperatureC }).verdict).toBe(verdict);
  });
});

describe("assessSprayConditions — missing readings", () => {
  /**
   * The assessment's whole claim is that four things are true at once. Three of
   * four known is not four of four, so an absent reading is a caution and never
   * a go — the same rule the marine advice follows.
   */
  it.each([
    ["windSpeedKmh"],
    ["precipitationProbability"],
    ["relativeHumidity"],
    ["temperatureC"],
  ])("never says go with %s missing", (field) => {
    const result = assessSprayConditions({ ...IDEAL, [field]: null });
    expect(result.verdict).toBe("caution");
    expect(result.reasons).not.toEqual([]);
  });

  it("treats NaN as missing rather than as a number", () => {
    expect(
      assessSprayConditions({ ...IDEAL, windSpeedKmh: Number.NaN }).verdict,
    ).toBe("caution");
  });
});

describe("assessSprayConditions — a no-go outranks a caution", () => {
  it("does not soften a stop condition because the rest are fine", () => {
    const result = assessSprayConditions({
      ...IDEAL,
      windSpeedKmh: 35,
      relativeHumidity: 20,
    });
    expect(result.verdict).toBe("no-go");
    expect(result.risk).toBe("high");
    expect(result.reasons).toHaveLength(2);
  });
});

describe("findSprayWindows", () => {
  /** 8 hours: 0-1 ideal, 2-3 too windy, 4-5 ideal, 6-7 marginal humidity. */
  const hourly = {
    time: Array.from({ length: 8 }, (_, i) => `2026-09-05T0${i}:00`),
    wind_speed_10m: [8, 8, 35, 35, 8, 8, 8, 8],
    precipitation_probability: [5, 5, 5, 5, 5, 5, 5, 5],
    relative_humidity_2m: [60, 60, 60, 60, 60, 60, 25, 25],
    temperature_2m: [18, 18, 18, 18, 18, 18, 18, 18],
  };

  it("returns the runs of consecutive sprayable hours", () => {
    const windows = findSprayWindows(hourly);

    expect(windows).toHaveLength(3);
    expect(windows[0]).toMatchObject({ startIndex: 0, endIndex: 1, verdict: "go", hours: 2 });
    expect(windows[1]).toMatchObject({ startIndex: 4, endIndex: 5, verdict: "go" });
    expect(windows[2]).toMatchObject({ startIndex: 6, endIndex: 7, verdict: "caution" });
  });

  /**
   * A clean run and a marginal one either side of it are different answers to
   * "when can I spray", so they must not merge into one long window that
   * claims the marginal hours were clean.
   */
  it("splits a run where the verdict changes", () => {
    const windows = findSprayWindows(hourly, { fromIndex: 4 });
    expect(windows.map((w) => w.verdict)).toEqual(["go", "caution"]);
  });

  it("drops runs shorter than the minimum — one hour is not a window", () => {
    const short = {
      ...hourly,
      wind_speed_10m: [8, 35, 35, 35, 35, 35, 35, 35],
    };
    expect(findSprayWindows(short)).toEqual([]);
    expect(findSprayWindows(short, { minimumHours: 1 })).toHaveLength(1);
  });

  it("carries the series' own timestamps for display", () => {
    expect(findSprayWindows(hourly)[0]).toMatchObject({
      startTime: "2026-09-05T00:00",
      endTime: "2026-09-05T01:00",
    });
  });

  it("answers an empty list for a missing payload", () => {
    expect(findSprayWindows(undefined)).toEqual([]);
  });
});
