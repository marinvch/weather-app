import { describe, expect, it } from "vitest";
import {
  DEFAULT_BASE_TEMPERATURE_C,
  accumulateGdd,
  describeAccumulation,
  growingDegreeDays,
} from "./gdd";

describe("growingDegreeDays — simple method", () => {
  it("is the daily mean above the base temperature", () => {
    // (25 + 15) / 2 = 20, less base 10 = 10 degree-days.
    expect(growingDegreeDays(15, 25)).toBe(10);
  });

  it("defaults to base 10°C, the maize convention", () => {
    expect(DEFAULT_BASE_TEMPERATURE_C).toBe(10);
    expect(growingDegreeDays(15, 25)).toBe(growingDegreeDays(15, 25, { base: 10 }));
  });

  it("takes a crop-specific base", () => {
    // Winter wheat at base 0 earns the whole mean.
    expect(growingDegreeDays(15, 25, { base: 0 })).toBe(20);
    expect(growingDegreeDays(15, 25, { base: 4.5 })).toBe(15.5);
  });

  /**
   * The clamp is the load-bearing part. Without it a cold snap would *remove*
   * accumulated degree-days and report a crop moving backwards through its
   * stages, which is not how development works.
   */
  it("is zero, never negative, on a day colder than the base", () => {
    expect(growingDegreeDays(-5, 5)).toBe(0);
    expect(growingDegreeDays(-20, -10)).toBe(0);
  });

  it("is zero exactly at the base", () => {
    expect(growingDegreeDays(10, 10)).toBe(0);
  });

  it("gives the same answer whichever way round the extremes arrive", () => {
    expect(growingDegreeDays(25, 15)).toBe(growingDegreeDays(15, 25));
  });

  it("answers zero rather than NaN for an unreadable day", () => {
    expect(growingDegreeDays(Number.NaN, 25)).toBe(0);
    expect(growingDegreeDays(15, Number.NaN)).toBe(0);
  });
});

describe("growingDegreeDays — modified method with an upper threshold", () => {
  /**
   * Above its upper threshold a crop stalls rather than growing faster, so a
   * 40°C afternoon must not be credited as development. The modified method
   * clamps both extremes into [base, upper] before averaging.
   */
  it("caps a hot maximum at the upper threshold", () => {
    // Simple method would give (40+20)/2 - 10 = 20.
    expect(growingDegreeDays(20, 40, { base: 10, upper: 30 })).toBe(15);
  });

  it("raises a minimum below the base up to it", () => {
    // min 5 clamps to 10; (10 + 20) / 2 - 10 = 5.
    expect(growingDegreeDays(5, 20, { base: 10, upper: 30 })).toBe(5);
  });

  it("agrees with the simple method when the day sits inside the range", () => {
    expect(growingDegreeDays(15, 25, { base: 10, upper: 30 })).toBe(
      growingDegreeDays(15, 25, { base: 10 }),
    );
  });

  it("is zero on a day entirely above the upper threshold", () => {
    // Both extremes clamp to 30; (30 + 30) / 2 - 10 = 20, which is the most a
    // base-10/upper-30 crop can earn in a day.
    expect(growingDegreeDays(35, 45, { base: 10, upper: 30 })).toBe(20);
  });
});

describe("accumulateGdd", () => {
  const daily = {
    time: ["2026-09-01", "2026-09-02", "2026-09-03"],
    temperature_2m_min: [12, 14, 8],
    temperature_2m_max: [22, 26, 14],
  };

  it("accumulates across the window and reports a running total", () => {
    const result = accumulateGdd(daily);

    expect(result.days.map((d) => d.gdd)).toEqual([7, 10, 1]);
    expect(result.days.map((d) => d.cumulative)).toEqual([7, 17, 18]);
    expect(result.total).toBe(18);
    expect(result.base).toBe(10);
  });

  it("carries the date through from the payload", () => {
    expect(accumulateGdd(daily).days[1].date).toBe("2026-09-02");
  });

  /**
   * A gap in the model is not a day without growth. Scoring it as zero would
   * understate the total by exactly the amount nobody notices, so the day is
   * dropped and counted instead.
   */
  it("skips and counts days with a missing extreme", () => {
    const result = accumulateGdd({
      time: ["2026-09-01", "2026-09-02"],
      temperature_2m_min: [12, null],
      temperature_2m_max: [22, 26],
    });

    expect(result.days).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.total).toBe(7);
  });

  it("answers an empty accumulation for a missing payload", () => {
    const result = accumulateGdd(undefined);
    expect(result.days).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe("describeAccumulation", () => {
  const window = (perDayGdd: number, days = 7) =>
    accumulateGdd({
      time: Array.from({ length: days }, (_, i) => `2026-09-0${i + 1}`),
      // A day of (min, max) = (base + 2g, base + 2g) earns exactly g.
      temperature_2m_min: new Array(days).fill(10 + perDayGdd),
      temperature_2m_max: new Array(days).fill(10 + perDayGdd),
    });

  it("names the pace, and never claims a crop stage from a 7-day window", () => {
    expect(describeAccumulation(window(0.5))).toMatch(/too cold/);
    expect(describeAccumulation(window(3))).toMatch(/Slow accumulation/);
    expect(describeAccumulation(window(8))).toMatch(/Steady accumulation/);
    expect(describeAccumulation(window(15))).toMatch(/Fast accumulation/);
  });

  it("says so when there is nothing to describe", () => {
    expect(describeAccumulation(accumulateGdd(undefined))).toMatch(
      /No daily temperatures/,
    );
  });
});
