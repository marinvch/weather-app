import { describe, expect, it } from "vitest";
import { adviseAgriculture } from "./advice";
import { soilMoistureCondition, soilMoisturePercent } from "./conditions";
import type { AgriculturalResponse } from "@/shared/types/weather";

/**
 * `adviseAgriculture` is pure — a payload in, advice out. Tested directly.
 *
 * The fixture defaults describe a good day on well-watered soil: 0.30 m³/m³ is
 * 30% volumetric water content, which is a healthy loam and nowhere near dry.
 */
function agri(
  current: Partial<AgriculturalResponse["current"]> = {},
  extra: {
    daily?: Partial<AgriculturalResponse["daily"]>;
    hourly?: Partial<AgriculturalResponse["hourly"]>;
  } = {},
): AgriculturalResponse {
  return {
    latitude: 42.5,
    longitude: 25.6,
    timezone: "Europe/Sofia",
    current: {
      time: "2026-09-05T12:00",
      temperature_2m: 20,
      relative_humidity_2m: 60,
      wind_speed_10m: 8,
      wind_direction_10m: 180,
      weather_code: 0,
      is_day: 1,
      soil_temperature_0cm: 18,
      soil_moisture_0_1cm: 0.3,
      ...current,
    },
    hourly: {
      time: ["2026-09-05T00:00"],
      precipitation_probability: [5],
      ...extra.hourly,
    },
    daily: {
      time: ["2026-09-05", "2026-09-06"],
      temperature_2m_min: [12, 14],
      temperature_2m_max: [22, 26],
      ...extra.daily,
    },
  } as unknown as AgriculturalResponse;
}

describe("adviseAgriculture — the soil-moisture unit trap", () => {
  /**
   * The bug this guards: `soil_moisture_0_1cm` is m³/m³, a 0–1 fraction, and
   * every threshold in the advice is a percentage. Compared raw, *every reading
   * on Earth* scores below 20 and produces "immediate irrigation recommended"
   * on a waterlogged field.
   */
  it("does not call well-watered soil dry", () => {
    const analysis = adviseAgriculture(agri({ soil_moisture_0_1cm: 0.3 }));

    expect(analysis.irrigationNeeded).toBe(false);
    expect(analysis.soilConditions).toBe("good");
    expect(analysis.profileSpecificTips).not.toContain(
      "Immediate irrigation recommended",
    );
  });

  it("shows the raw and converted figures side by side in the reasoning", () => {
    const analysis = adviseAgriculture(agri({ soil_moisture_0_1cm: 0.3 }));
    expect(analysis.reasoning).toMatch(/30\.0%/);
    expect(analysis.reasoning).toMatch(/0\.3 m³\/m³/);
  });

  it("still calls genuinely dry soil dry", () => {
    // 0.08 m³/m³ is 8% — a real drought reading, below the 20% threshold.
    const analysis = adviseAgriculture(agri({ soil_moisture_0_1cm: 0.08 }));

    expect(analysis.irrigationNeeded).toBe(true);
    expect(analysis.soilConditions).toBe("poor");
    expect(analysis.profileSpecificTips).toContain(
      "Immediate irrigation recommended",
    );
  });

  it("has the tile and the advice card converting the same way", () => {
    // The two use different vocabularies and different bands — that overlap is
    // the unresolved duplication noted in conditions.ts. What must agree is the
    // conversion: neither may report the false "very dry" for the same reading.
    expect(soilMoistureCondition(0.3).text).toBe("Very dry"); // raw, the bug
    expect(soilMoistureCondition(soilMoisturePercent(0.3)).text).toBe("Adequate");
    expect(adviseAgriculture(agri()).soilConditions).not.toBe("poor");
  });

  it("flags waterlogging above 80%", () => {
    const analysis = adviseAgriculture(agri({ soil_moisture_0_1cm: 0.85 }));
    expect(analysis.profileSpecificTips).toContain(
      "Risk of waterlogging - improve drainage",
    );
  });
});

describe("adviseAgriculture — frost", () => {
  it.each([
    [1, "severe", "high"],
    [4, "moderate", "medium"],
    [10, "none", "low"],
  ])("reads %s°C as %s frost risk", (temperature_2m, frostRisk, riskLevel) => {
    const analysis = adviseAgriculture(agri({ temperature_2m }));
    expect(analysis.frostRisk).toBe(frostRisk);
    expect(analysis.riskLevel).toBe(riskLevel);
  });

  it("flags a light frost risk on a cool, humid night", () => {
    const analysis = adviseAgriculture(
      agri({ temperature_2m: 6, relative_humidity_2m: 90 }),
    );
    expect(analysis.frostRisk).toBe("light");
  });
});

describe("adviseAgriculture — spray window", () => {
  it("says the window is open in clean conditions", () => {
    const tips = adviseAgriculture(agri()).profileSpecificTips.join(" ");
    expect(tips).toMatch(/Spray window open/);
  });

  it("says do not spray when the wind is up", () => {
    const tips = adviseAgriculture(
      agri({ wind_speed_10m: 35 }),
    ).profileSpecificTips.join(" ");

    expect(tips).toMatch(/Do not spray/);
    expect(tips).toMatch(/drift is unavoidable/);
  });

  it("reads the probability of rain out of the hourly series", () => {
    const tips = adviseAgriculture(
      agri({}, { hourly: { precipitation_probability: [90] } }),
    ).profileSpecificTips.join(" ");

    expect(tips).toMatch(/wash-off/);
  });
});

describe("adviseAgriculture — growing degree days", () => {
  it("reports the accumulation over the forecast window at base 10°C", () => {
    // (22+12)/2 - 10 = 7, and (26+14)/2 - 10 = 10. Total 17.
    const tips = adviseAgriculture(agri()).profileSpecificTips.join(" ");
    expect(tips).toMatch(/17 growing degree-days forecast over 2 days at base 10°C/);
  });

  it("leaves the line out entirely when there are no daily temperatures", () => {
    const tips = adviseAgriculture(
      agri({}, { daily: { time: [], temperature_2m_min: [], temperature_2m_max: [] } }),
    ).profileSpecificTips.join(" ");

    expect(tips).not.toMatch(/degree-days/);
  });
});

describe("adviseAgriculture — no data", () => {
  it("returns the unavailable shape without current conditions", () => {
    const empty = { ...agri(), current: undefined } as unknown as AgriculturalResponse;
    const analysis = adviseAgriculture(empty);

    expect(analysis.confidence).toBe(0);
    expect(analysis.irrigationNeeded).toBe(false);
    expect(analysis.frostRisk).toBe("none");
    expect(analysis.plantingConditions).toBe("Unknown");
  });
});
