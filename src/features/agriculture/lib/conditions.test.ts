import { describe, expect, it } from "vitest";
import { frostRisk, soilMoistureCondition, soilMoisturePercent } from "./conditions";
import { adviseAgriculture } from "./advice";

describe("soilMoisturePercent", () => {
  /**
   * This is the whole reason the helper exists. Open-Meteo's
   * `soil_moisture_0_1cm` is m³/m³, and feeding it to the thresholds raw made
   * every reading on Earth "Very dry — immediate irrigation needed", because
   * volumetric water content never reaches 10 on that scale.
   */
  it("converts m³/m³ to a percentage", () => {
    expect(soilMoisturePercent(0.141)).toBeCloseTo(14.1);
    expect(soilMoisturePercent(0)).toBe(0);
  });

  it("moves a real reading out of the false 'Very dry' band", () => {
    const raw = 0.141;
    expect(soilMoistureCondition(raw).text).toBe("Very dry");
    expect(soilMoistureCondition(soilMoisturePercent(raw)).text).toBe("Dry");
  });
});

describe("the tile and the advice card disagree about frost and soil", () => {
  /**
   * This block asserts the *disagreement*, deliberately — the same device the
   * mountain feature used before its two avalanche scorers were reconciled.
   *
   * It exists so that nobody can "fix" one side alone without a test going
   * red, and so the conflict is visible as executable fact rather than only as
   * a comment. Unlike the mountain case, this one cannot be composed away: the
   * same word covers different ranges on each side, so resolving it means
   * deciding what the words mean. See the header of ./conditions.ts.
   *
   * **When that decision is made, this block should fail. Replace it with an
   * agreement test — do not update the expectations to match one side.**
   */
  function at(temp: number, humidity = 60, volumetricSoilMoisture = 0.3) {
    return adviseAgriculture({
      latitude: 42.5,
      longitude: 25.6,
      timezone: "Europe/Sofia",
      current: {
        time: "2026-09-05T12:00",
        temperature_2m: temp,
        relative_humidity_2m: humidity,
        wind_speed_10m: 8,
        wind_direction_10m: 180,
        weather_code: 0,
        is_day: 1,
        soil_temperature_0cm: 18,
        soil_moisture_0_1cm: volumetricSoilMoisture,
      },
      hourly: { time: ["2026-09-05T00:00"], precipitation_probability: [5] },
      daily: { time: [], temperature_2m_min: [], temperature_2m_max: [] },
    } as unknown as Parameters<typeof adviseAgriculture>[0]);
  }

  it.each([
    // temp, tile band, advice band
    [6, "None", "light", 90],
    [3, "Low", "moderate", 60],
    [1, "Moderate", "severe", 60],
  ])(
    "reads %s°C as %s on the tile and %s on the card",
    (temp, tileBand, adviceBand, humidity) => {
      expect(frostRisk(temp as number).text).toBe(tileBand);
      expect(at(temp as number, humidity as number).frostRisk).toBe(adviceBand);
    },
  );

  it("uses 'adequate' for opposite ends of the moisture range", () => {
    // The tile calls 20-40% "Adequate"...
    expect(soilMoistureCondition(30).text).toBe("Adequate");
    // ...while the card reserves "adequate" for waterlogged ground above 80%.
    expect(at(20, 60, 0.85).soilConditions).toBe("adequate");
    // At the tile's "Adequate" moisture the card says something else entirely.
    expect(at(20, 60, 0.3).soilConditions).not.toBe("adequate");
  });
});
