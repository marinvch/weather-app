import { describe, expect, it } from "vitest";
import { hasRiverData, readRiverDischarge } from "./river";
import type { FloodResponse } from "@/shared/types/weather";

function flood(river_discharge: (number | null)[] | undefined): FloodResponse {
  return {
    latitude: 42.5,
    longitude: 25.6,
    timezone: "Europe/Sofia",
    daily: {
      time: (river_discharge ?? []).map((_, i) => `2026-09-0${i + 1}`),
      ...(river_discharge ? { river_discharge } : {}),
    },
  };
}

describe("hasRiverData", () => {
  /**
   * GloFAS answers a coordinate with no modelled river nearby with HTTP 200 and
   * a full-length series of nulls — the same shape as the marine host inland.
   * A present response is not proof of usable data.
   */
  it("is false for the no-river case: 200 with a series of nulls", () => {
    expect(hasRiverData(flood([null, null, null]))).toBe(false);
  });

  it("is true when any day carries a figure", () => {
    expect(hasRiverData(flood([null, 12.5, null]))).toBe(true);
  });

  it("is true for a dry channel, which is a reading", () => {
    expect(hasRiverData(flood([0, 0]))).toBe(true);
  });

  it("is false for a missing payload or an absent series", () => {
    expect(hasRiverData(undefined)).toBe(false);
    expect(hasRiverData(flood(undefined))).toBe(false);
    expect(hasRiverData(flood([]))).toBe(false);
  });
});

describe("readRiverDischarge", () => {
  it("reports a sharp rise when the peak more than doubles today's level", () => {
    const reading = readRiverDischarge(flood([100, 140, 220, 260]));

    expect(reading?.trend).toBe("rising-sharply");
    expect(reading?.risk).toBe("high");
    expect(reading?.peakM3s).toBe(260);
    expect(reading?.daysToPeak).toBe(3);
    expect(reading?.peakRatio).toBeCloseTo(2.6);
    expect(reading?.advice).toMatch(/flood warning service/);
  });

  it("reports an ordinary rise between 1.3x and 2x", () => {
    const reading = readRiverDischarge(flood([100, 120, 150]));
    expect(reading?.trend).toBe("rising");
    expect(reading?.risk).toBe("moderate");
  });

  it("calls a river receding from today's level falling", () => {
    // The series runs forward from today, so a fall is today sitting above the
    // days ahead. Read the other way round, a receding flood reports as a rise.
    const reading = readRiverDischarge(flood([200, 150, 120, 100]));
    expect(reading?.trend).toBe("falling");
    expect(reading?.risk).toBe("low");
  });

  it("calls a flat series steady", () => {
    const reading = readRiverDischarge(flood([100, 100, 100]));
    expect(reading?.trend).toBe("steady");
    expect(reading?.peakRatio).toBe(1);
  });

  /**
   * A dry channel is a real reading and dividing by it is not. Without this the
   * ratio is Infinity and every dry watercourse reads as a flood.
   */
  it("does not divide by a dry channel", () => {
    const reading = readRiverDischarge(flood([0, 5, 10]));
    expect(reading?.peakRatio).toBe(1);
    expect(Number.isFinite(reading?.peakRatio ?? NaN)).toBe(true);
  });

  it("skips null days rather than treating them as zero flow", () => {
    const reading = readRiverDischarge(flood([100, null, 150]));
    expect(reading?.currentM3s).toBe(100);
    expect(reading?.peakM3s).toBe(150);
  });

  it("answers null when there is no usable series at all", () => {
    expect(readRiverDischarge(flood([null, null]))).toBeNull();
    expect(readRiverDischarge(flood(undefined))).toBeNull();
    expect(readRiverDischarge(undefined)).toBeNull();
  });
});
