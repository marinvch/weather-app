import { describe, expect, it } from "vitest";
import {
  coordinatesKey,
  formatCoordinates,
  isValidCoordinates,
  normalizeCoordinates,
  sameCoordinates,
  WGS84,
} from "./geo";

const BURGAS = { latitude: 42.4619, longitude: 27.4039 };

describe("isValidCoordinates", () => {
  it("accepts a point in range", () => {
    expect(isValidCoordinates(BURGAS)).toBe(true);
  });

  it("accepts the exact bounds", () => {
    expect(isValidCoordinates({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidCoordinates({ latitude: -90, longitude: -180 })).toBe(true);
  });

  it("rejects out-of-range, non-finite and missing values", () => {
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidCoordinates({ latitude: NaN, longitude: 0 })).toBe(false);
    expect(isValidCoordinates(null)).toBe(false);
    expect(isValidCoordinates(undefined)).toBe(false);
  });
});

describe("normalizeCoordinates", () => {
  it("leaves a valid point alone", () => {
    expect(normalizeCoordinates(BURGAS)).toEqual(BURGAS);
  });

  it("clamps latitude at the poles rather than wrapping", () => {
    expect(normalizeCoordinates({ latitude: 95, longitude: 0 }).latitude).toBe(
      90,
    );
    expect(normalizeCoordinates({ latitude: -95, longitude: 0 }).latitude).toBe(
      -90,
    );
  });

  it("wraps longitude around the antimeridian", () => {
    // A map dragged east past the antimeridian hands back 187°, which
    // Open-Meteo rejects. It is 173° west.
    expect(normalizeCoordinates({ latitude: 0, longitude: 187 }).longitude).toBe(
      -173,
    );
    expect(
      normalizeCoordinates({ latitude: 0, longitude: -412 }).longitude,
    ).toBe(-52);
  });

  it("leaves an in-range longitude bit-for-bit alone", () => {
    // The wrapping arithmetic costs a few ulps, which is enough to break a
    // cache key. Both bounds are in range, so neither is touched.
    expect(normalizeCoordinates({ latitude: 0, longitude: 180 }).longitude).toBe(
      180,
    );
    expect(normalizeCoordinates(BURGAS).longitude).toBe(27.4039);
  });

  it("always produces a point that validates", () => {
    for (const longitude of [187, -412, 360, 720.5]) {
      expect(
        isValidCoordinates(normalizeCoordinates({ latitude: 95, longitude })),
      ).toBe(true);
    }
  });
});

describe("formatCoordinates", () => {
  it("renders at WGS84.precision by default", () => {
    expect(formatCoordinates(BURGAS)).toBe("42.4619, 27.4039");
    expect(WGS84.precision).toBe(4);
  });

  it("pads to the full precision", () => {
    expect(formatCoordinates({ latitude: 42.5, longitude: -3 })).toBe(
      "42.5000, -3.0000",
    );
  });
});

describe("coordinatesKey", () => {
  /**
   * The reason this rounds. A stationary device still reports drift in the far
   * decimals; an unrounded key missed on every reading, which is what drove the
   * reverse-geocode loop into Nominatim's rate limit.
   */
  it("ignores drift below display precision", () => {
    const drifted = { latitude: 42.46190004, longitude: 27.40389997 };
    expect(coordinatesKey(drifted)).toBe(coordinatesKey(BURGAS));
    expect(sameCoordinates(drifted, BURGAS)).toBe(true);
  });

  it("distinguishes points that differ at display precision", () => {
    expect(sameCoordinates(BURGAS, { latitude: 42.462, longitude: 27.4039 })).toBe(
      false,
    );
  });

  it("normalizes before keying, so the same meridian keys once", () => {
    expect(coordinatesKey({ latitude: 0, longitude: 187 })).toBe(
      coordinatesKey({ latitude: 0, longitude: -173 }),
    );
  });
});
