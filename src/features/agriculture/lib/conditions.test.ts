import { describe, expect, it } from "vitest";
import { soilMoistureCondition, soilMoisturePercent } from "./conditions";

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
