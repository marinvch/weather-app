import { describe, expect, it } from "vitest";
import { at, currentHourIndex, hasMarineData, readingsAt } from "./readings";
import type { MarineResponse } from "@/shared/types/weather";

describe("at", () => {
  it("narrows a null the type system promised was a number", () => {
    // The cast is the whole point: `MarineResponse` types these as `number[]`
    // and the marine host fills them with nulls inland.
    const series = [1, null, 3] as unknown as number[];
    expect(at(series, 0)).toBe(1);
    expect(at(series, 1)).toBeNull();
  });

  it("answers null past the end of the series, not undefined", () => {
    expect(at([1, 2], 9)).toBeNull();
    expect(at(undefined, 0)).toBeNull();
  });

  it("rejects NaN and Infinity, which format as garbage", () => {
    expect(at([Number.NaN], 0)).toBeNull();
    expect(at([Number.POSITIVE_INFINITY], 0)).toBeNull();
  });

  it("keeps a real zero, which is a reading and not a gap", () => {
    expect(at([0], 0)).toBe(0);
  });
});

describe("currentHourIndex", () => {
  it("uses the local hour into a midnight-anchored series", () => {
    expect(currentHourIndex(24, new Date("2026-09-05T13:30:00"))).toBe(13);
    expect(currentHourIndex(24, new Date("2026-09-05T00:05:00"))).toBe(0);
  });

  it("clamps to the last element of a short series", () => {
    // `forecast_hours: 1` returns a one-element series; hour 13 would index
    // undefined and crash on `.toFixed`.
    expect(currentHourIndex(1, new Date("2026-09-05T13:30:00"))).toBe(0);
  });

  it("answers 0 for an empty series rather than -1", () => {
    expect(currentHourIndex(0)).toBe(0);
  });
});

describe("hasMarineData", () => {
  const withHeights = (values: (number | null)[]) =>
    ({
      latitude: 0,
      longitude: 0,
      timezone: "UTC",
      hourly: { time: values.map(() => "t"), wave_height: values },
    }) as unknown as MarineResponse;

  it("is false for the inland case — 200 with a full series of nulls", () => {
    expect(hasMarineData(withHeights([null, null, null]))).toBe(false);
  });

  it("is true when any hour has a reading, so one model gap is not 'no sea'", () => {
    expect(hasMarineData(withHeights([null, 0.6, null]))).toBe(true);
  });

  it("is true for a genuinely flat sea", () => {
    expect(hasMarineData(withHeights([0, 0]))).toBe(true);
  });

  it("is false for a missing payload or an empty series", () => {
    expect(hasMarineData(undefined)).toBe(false);
    expect(hasMarineData(withHeights([]))).toBe(false);
  });
});

describe("readingsAt", () => {
  it("returns every field narrowed, with nulls where the model has nothing", () => {
    const response = {
      latitude: 0,
      longitude: 0,
      timezone: "UTC",
      hourly: {
        time: ["t"],
        wave_height: [1.2],
        sea_surface_temperature: [null],
      },
    } as unknown as MarineResponse;

    expect(readingsAt(response, 0)).toMatchObject({
      waveHeight: 1.2,
      seaSurfaceTemperature: null,
      swellHeight: null,
    });
  });

  it("answers all-null for an absent payload rather than throwing", () => {
    const readings = readingsAt(undefined, 0);
    expect(Object.values(readings).every((v) => v === null)).toBe(true);
  });
});
