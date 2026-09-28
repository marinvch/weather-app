import { describe, expect, it } from "vitest";
import { adviseMarine } from "./advice";
import type { MarineResponse } from "@/shared/types/weather";

/**
 * `adviseMarine` is pure: a payload in, advice out. Tested directly — going
 * through RTK Query would test `fetch`.
 *
 * The clock is injected because the analysis reads the hour that matches the
 * series index. Without that, this suite would pass or fail depending on what
 * time of day it ran.
 */
const NOON = new Date("2026-09-05T12:00:00");

/**
 * A marine payload whose series are 24 hours long and constant, so index 12
 * (noon) holds whatever the test asked for.
 *
 * `nulls` builds the inland case: the marine host answers a coordinate that is
 * not at sea with HTTP 200 and a full-length series of nulls. `MarineResponse`
 * types those as `number[]`, which is the lie this feature guards against — so
 * the cast is the point of the fixture, not a shortcut around the types.
 */
function marine(
  overrides: Partial<Record<string, (number | null)[]>> = {},
): MarineResponse {
  const hours = Array.from({ length: 24 }, (_, i) =>
    `2026-09-05T${String(i).padStart(2, "0")}:00`,
  );
  const flat = (value: number | null) => new Array(24).fill(value);

  return {
    latitude: 42.5,
    longitude: 27.5,
    timezone: "Europe/Sofia",
    hourly: {
      time: hours,
      wave_height: flat(0.4),
      wave_direction: flat(90),
      wave_period: flat(5),
      wind_wave_height: flat(0.2),
      wind_wave_direction: flat(90),
      wind_wave_period: flat(3),
      swell_wave_height: flat(0.3),
      swell_wave_direction: flat(180),
      swell_wave_period: flat(9),
      ocean_current_velocity: flat(0.2),
      ocean_current_direction: flat(45),
      sea_surface_temperature: flat(22),
      ...overrides,
    },
  } as unknown as MarineResponse;
}

describe("adviseMarine — the no-data case", () => {
  /**
   * The bug this replaced: the old scorer read `wave_height[0] || 0`, so an
   * all-null inland series became 0 m, which became "excellent fishing
   * conditions" on a farm. Missing data must never score as good conditions.
   */
  it("refuses to advise when every wave reading is null", () => {
    const analysis = adviseMarine(marine({ wave_height: new Array(24).fill(null) }), {
      now: NOON,
    });

    expect(analysis.confidence).toBe(0);
    expect(analysis.fishingConditions).toBe("poor");
    expect(analysis.seaState).toBe("Unknown");
    expect(analysis.recommendation).toMatch(/No sea state available/);
    expect(analysis.riskLevel).not.toBe("low");
  });

  it("refuses to advise when the hourly series is empty", () => {
    const empty = { ...marine(), hourly: { time: [] } } as unknown as MarineResponse;
    expect(adviseMarine(empty, { now: NOON }).confidence).toBe(0);
  });

  it("does not call a null sea calm", () => {
    const analysis = adviseMarine(marine({ wave_height: new Array(24).fill(null) }), {
      now: NOON,
    });
    expect(analysis.waveAnalysis).not.toMatch(/0\.0 m/);
  });
});

describe("adviseMarine — sea state", () => {
  it("reports the Douglas degree and label", () => {
    const analysis = adviseMarine(marine(), { now: NOON });
    expect(analysis.seaState).toBe("Smooth (Douglas 2)");
    expect(analysis.fishingConditions).toBe("excellent");
    expect(analysis.riskLevel).toBe("low");
  });

  it("drops to fair at Douglas 4 and poor at Douglas 5", () => {
    const at = (height: number) =>
      adviseMarine(marine({ wave_height: new Array(24).fill(height) }), {
        now: NOON,
      });

    expect(at(1.0).fishingConditions).toBe("good");
    expect(at(1.5).fishingConditions).toBe("fair");
    expect(at(1.5).riskLevel).toBe("medium");
    expect(at(3.0).fishingConditions).toBe("poor");
    expect(at(3.0).riskLevel).toBe("high");
  });

  it("names the swell bearing as a compass point, not a number", () => {
    const analysis = adviseMarine(
      marine({ swell_wave_direction: new Array(24).fill(225) }),
      { now: NOON },
    );
    expect(analysis.waveAnalysis).toMatch(/swell 0\.3 m from the SW/);
  });
});

describe("adviseMarine — wind", () => {
  it("leaves the Beaufort half out entirely when no wind was supplied", () => {
    const analysis = adviseMarine(marine(), { now: NOON });
    expect(analysis.reasoning).not.toMatch(/Beaufort/);
    expect(analysis.confidence).toBe(70);
  });

  it("includes it, and raises confidence, when wind is supplied", () => {
    // 25 km/h is 13.5 kn — force 4, "moderate breeze".
    const analysis = adviseMarine(marine(), { now: NOON, windSpeedKmh: 25 });
    expect(analysis.reasoning).toMatch(/Beaufort force 4/);
    expect(analysis.confidence).toBe(85);
  });

  /**
   * The reading a wave height alone cannot give: the wind has got up but the
   * sea has not built yet. A scorer that only looked at the 0.4 m wave would
   * call this "excellent" and send a small boat out into a rising gale.
   */
  it("downgrades a flat sea under a strong breeze, because it will build", () => {
    const analysis = adviseMarine(marine(), { now: NOON, windSpeedKmh: 50 });

    expect(analysis.fishingConditions).toBe("fair");
    expect(analysis.profileSpecificTips.join(" ")).toMatch(/has not caught up/);
  });

  it("takes the worst of sea and wind rather than averaging them", () => {
    // Douglas 2 (low) under force 8 (severe). An average would read "moderate".
    const analysis = adviseMarine(marine(), { now: NOON, windSpeedKmh: 70 });
    expect(analysis.riskLevel).toBe("high");
    expect(analysis.profileSpecificTips.join(" ")).toMatch(/do not put to sea/i);
  });
});

describe("adviseMarine — water temperature and composition", () => {
  it("carries the cold-water immersion advice through as a tip", () => {
    const analysis = adviseMarine(
      marine({ sea_surface_temperature: new Array(24).fill(6) }),
      { now: NOON },
    );
    expect(analysis.profileSpecificTips.join(" ")).toMatch(/Cold shock/);
    expect(analysis.riskLevel).toBe("high");
  });

  it("warns about a short steep sea when the wind wave dominates", () => {
    const analysis = adviseMarine(
      marine({
        wave_height: new Array(24).fill(1.0),
        wind_wave_height: new Array(24).fill(0.9),
        swell_wave_height: new Array(24).fill(0.1),
      }),
      { now: NOON },
    );
    expect(analysis.profileSpecificTips.join(" ")).toMatch(/Short, steep wind wave/);
  });

  it("flags a strong current with its set", () => {
    const analysis = adviseMarine(
      marine({
        ocean_current_velocity: new Array(24).fill(2),
        ocean_current_direction: new Array(24).fill(270),
      }),
      { now: NOON },
    );
    expect(analysis.profileSpecificTips.join(" ")).toMatch(/setting W/);
    expect(analysis.tideRecommendation).toMatch(/tidal flow/);
  });
});

describe("adviseMarine — best window", () => {
  it("reads the calmest of the next twelve hours out of the series", () => {
    const heights = new Array(24).fill(2.0);
    heights[15] = 0.4;

    const analysis = adviseMarine(marine({ wave_height: heights }), {
      now: NOON,
    });

    expect(analysis.bestTimeForActivity).toMatch(/0\.4 m/);
  });

  it("says so when now is already the calmest hour", () => {
    const analysis = adviseMarine(marine(), { now: NOON });
    expect(analysis.bestTimeForActivity).toMatch(/^Now —/);
  });

  it("does not look past the twelve-hour window", () => {
    const heights = new Array(24).fill(2.0);
    heights[23] = 0.1; // 11 hours after noon is index 23 — just inside.
    heights[12] = 2.0;

    const analysis = adviseMarine(marine({ wave_height: heights }), {
      now: NOON,
    });
    expect(analysis.bestTimeForActivity).toMatch(/0\.1 m/);

    // Same trough one hour further out is unreachable from a 24-hour series,
    // so the advice falls back to "nothing calmer".
    const shorter = new Array(24).fill(2.0);
    const analysis2 = adviseMarine(marine({ wave_height: shorter }), {
      now: NOON,
    });
    expect(analysis2.bestTimeForActivity).toMatch(/^Now —/);
  });
});
