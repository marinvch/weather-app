import { describe, it, expect } from "vitest";
import {
  ARROW_BIN_COUNT,
  ARROW_RAMP,
  arrowIconHtml,
  arrowRotationDegrees,
  arrowSizePx,
  binRanges,
  describeSample,
  isRenderableSample,
  magnitudeBin,
  normalizeDegrees,
  resolveScaleMax,
  type DirectionSample,
} from "./arrowField";

function sample(overrides: Partial<DirectionSample> = {}): DirectionSample {
  return {
    latitude: 42.4619,
    longitude: 27.4039,
    directionDegrees: 220,
    magnitude: 18,
    ...overrides,
  };
}

describe("normalizeDegrees", () => {
  it("returns an in-range angle bit-for-bit", () => {
    // Not `(x + 360) % 360`: that arithmetic costs an ulp and turns 359.9 into
    // 359.90000000000003, which is a visibly different arrow at high zoom.
    expect(normalizeDegrees(359.9)).toBe(359.9);
    expect(normalizeDegrees(27.4039)).toBe(27.4039);
  });

  it("wraps at 360 in both directions", () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(361)).toBe(1);
    expect(normalizeDegrees(720)).toBe(0);
    expect(normalizeDegrees(-1)).toBe(359);
    expect(normalizeDegrees(-90)).toBe(270);
    expect(normalizeDegrees(-360)).toBe(0);
    expect(normalizeDegrees(-450)).toBe(270);
  });

  it("gives positive zero for north, not negative zero", () => {
    // `-0 % 360` is `-0`, and `Object.is(-0, 0)` is false — a north arrow that
    // fails an equality check is exactly the kind of bug that survives review.
    expect(Object.is(normalizeDegrees(-0), 0)).toBe(true);
    expect(Object.is(normalizeDegrees(-360), 0)).toBe(true);
  });

  it("does not pretend a non-finite angle is north", () => {
    expect(normalizeDegrees(Number.NaN)).toBeNaN();
    expect(normalizeDegrees(Number.POSITIVE_INFINITY)).toBeNaN();
  });
});

describe("arrowRotationDegrees", () => {
  // The whole point of the `convention` field: Open-Meteo's wind_direction_10m
  // is where the wind comes FROM, wave_direction is where the waves go TOWARDS.
  // Rendering both with the same rotation is wrong by 180° for one of them.
  it("points a 'towards' reading straight down its own bearing", () => {
    expect(arrowRotationDegrees(0, "towards")).toBe(0);
    expect(arrowRotationDegrees(90, "towards")).toBe(90);
    expect(arrowRotationDegrees(180, "towards")).toBe(180);
    expect(arrowRotationDegrees(270, "towards")).toBe(270);
  });

  it("flips a 'from' reading by 180 degrees", () => {
    // A southerly wind is reported as 180 and blows towards the north.
    expect(arrowRotationDegrees(180, "from")).toBe(0);
    expect(arrowRotationDegrees(0, "from")).toBe(180);
    expect(arrowRotationDegrees(90, "from")).toBe(270);
    expect(arrowRotationDegrees(270, "from")).toBe(90);
    expect(arrowRotationDegrees(220, "from")).toBe(40);
  });

  it("wraps across 0/360 under both conventions", () => {
    expect(arrowRotationDegrees(360, "towards")).toBe(0);
    expect(arrowRotationDegrees(450, "towards")).toBe(90);
    expect(arrowRotationDegrees(-1, "towards")).toBe(359);

    expect(arrowRotationDegrees(360, "from")).toBe(180);
    expect(arrowRotationDegrees(359, "from")).toBe(179);
    expect(arrowRotationDegrees(181, "from")).toBe(1);
    expect(arrowRotationDegrees(-90, "from")).toBe(90);
  });

  it("differs by exactly 180 degrees between the conventions, always", () => {
    for (let bearing = 0; bearing < 360; bearing += 7) {
      const from = arrowRotationDegrees(bearing, "from");
      const towards = arrowRotationDegrees(bearing, "towards");
      const gap = Math.abs(from - towards);
      expect(Math.min(gap, 360 - gap)).toBe(180);
    }
  });

  it("is its own inverse when applied twice under 'from'", () => {
    for (const bearing of [0, 1, 89, 180, 270, 359]) {
      const once = arrowRotationDegrees(bearing, "from");
      expect(arrowRotationDegrees(once, "from")).toBe(bearing % 360);
    }
  });
});

describe("magnitudeBin", () => {
  it("splits the scale into four equal steps", () => {
    expect(magnitudeBin(0, 40)).toBe(0);
    expect(magnitudeBin(9.9, 40)).toBe(0);
    expect(magnitudeBin(10, 40)).toBe(1);
    expect(magnitudeBin(20, 40)).toBe(2);
    expect(magnitudeBin(30, 40)).toBe(3);
  });

  it("clamps past the top of the scale instead of running off the ramp", () => {
    // An index of 4 would read ARROW_RAMP[4], which is undefined, and the
    // arrow would render with no fill at all — invisible, not obviously wrong.
    expect(magnitudeBin(400, 40)).toBe(ARROW_BIN_COUNT - 1);
    expect(magnitudeBin(-5, 40)).toBe(0);
  });

  it("falls back to the calmest step for unusable input", () => {
    expect(magnitudeBin(Number.NaN, 40)).toBe(0);
    expect(magnitudeBin(10, 0)).toBe(0);
    expect(magnitudeBin(10, Number.NaN)).toBe(0);
  });

  it("indexes a real palette key for every step", () => {
    for (let step = 0; step < ARROW_BIN_COUNT; step += 1) {
      expect(ARROW_RAMP[step]).toBeTypeOf("string");
    }
    expect(ARROW_RAMP).toHaveLength(ARROW_BIN_COUNT);
  });
});

describe("arrowSizePx", () => {
  it("grows with magnitude so the field reads without colour", () => {
    const calm = arrowSizePx(0, 40);
    const middling = arrowSizePx(20, 40);
    const gale = arrowSizePx(40, 40);
    expect(calm).toBeLessThan(middling);
    expect(middling).toBeLessThan(gale);
  });

  it("clamps rather than growing without bound", () => {
    expect(arrowSizePx(4000, 40)).toBe(arrowSizePx(40, 40));
    expect(arrowSizePx(-10, 40)).toBe(arrowSizePx(0, 40));
    expect(arrowSizePx(10, 0)).toBe(arrowSizePx(0, 1));
  });
});

describe("resolveScaleMax", () => {
  it("prefers a usable override, so readings stay comparable over time", () => {
    expect(resolveScaleMax([sample({ magnitude: 3 })], 40)).toBe(40);
  });

  it("scales to the largest reading when no override is given", () => {
    expect(
      resolveScaleMax([sample({ magnitude: 3 }), sample({ magnitude: 11 })]),
    ).toBe(11);
  });

  it("never returns zero, which would collapse every bin onto step 0", () => {
    expect(resolveScaleMax([])).toBe(1);
    expect(resolveScaleMax([sample({ magnitude: 0 })])).toBe(1);
    expect(resolveScaleMax([sample({ magnitude: 5 })], -1)).toBe(5);
    expect(resolveScaleMax([sample({ magnitude: 5 })], Number.NaN)).toBe(5);
  });
});

describe("isRenderableSample", () => {
  it("keeps a complete reading", () => {
    expect(isRenderableSample(sample())).toBe(true);
  });

  it("drops a reading with a hole in it", () => {
    // The marine host answers an inland coordinate with nulls rather than an
    // error, and those arrive here as NaN after arithmetic.
    expect(isRenderableSample(sample({ magnitude: Number.NaN }))).toBe(false);
    expect(isRenderableSample(sample({ directionDegrees: Number.NaN }))).toBe(
      false,
    );
    expect(isRenderableSample(sample({ latitude: Number.NaN }))).toBe(false);
  });
});

describe("binRanges", () => {
  it("labels four steps, the last one open-ended", () => {
    const ranges = binRanges(40);
    expect(ranges.map((range) => range.label)).toEqual([
      "0–10",
      "10–20",
      "20–30",
      "≥ 30",
    ]);
    expect(ranges[3].max).toBeNull();
  });

  it("keeps a decimal where whole numbers would collapse the scale", () => {
    // Wave height runs 0-4 m; rounding those bounds gives "0-1, 1-1, 1-2".
    expect(binRanges(4).map((range) => range.label)).toEqual([
      "0–1",
      "1–2",
      "2–3",
      "≥ 3",
    ]);
    expect(binRanges(2).map((range) => range.label)).toEqual([
      "0–0.5",
      "0.5–1",
      "1–1.5",
      "≥ 1.5",
    ]);
  });
});

describe("arrowIconHtml", () => {
  it("puts the rotation in a CSS transform, in degrees", () => {
    const html = arrowIconHtml({
      rotationDegrees: 40,
      sizePx: 24,
      color: "var(--mui-palette-risk-high-main)",
      title: "Wind 34 km/h",
    });
    expect(html).toContain("rotate(40deg)");
    expect(html).toContain("var(--mui-palette-risk-high-main)");
    expect(html).toContain('aria-label="Wind 34 km/h"');
  });

  it("escapes a label rather than interpolating it into the DOM", () => {
    const html = arrowIconHtml({
      rotationDegrees: 0,
      sizePx: 24,
      color: "#000",
      title: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("draws north rather than nothing when the rotation is unusable", () => {
    const html = arrowIconHtml({
      rotationDegrees: Number.NaN,
      sizePx: 24,
      color: "#000",
      title: "x",
    });
    expect(html).toContain("rotate(0deg)");
  });
});

describe("describeSample", () => {
  it("spells the convention out for a reader who cannot see the arrow", () => {
    expect(
      describeSample(sample({ directionDegrees: 220, magnitude: 34 }), {
        name: "Wind",
        unit: "km/h",
        convention: "from",
      }),
    ).toBe("Wind 34 km/h from 220°, running towards 40°");

    expect(
      describeSample(sample({ directionDegrees: 220, magnitude: 2.1 }), {
        name: "Waves",
        unit: "m",
        convention: "towards",
      }),
    ).toBe("Waves 2.1 m towards 220°");
  });
});
