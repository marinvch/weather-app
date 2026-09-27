import { describe, it, expect } from "vitest";
import {
  dominantPollutant,
  europeanAqiBand,
  pollenBand,
  pollenReadings,
  pollutantSubIndex,
  uvBand,
} from "./aqi";
import type { AirQualityCurrent } from "@/shared/types/weather";

/**
 * Boundary tests, not sample tests.
 *
 * These functions are a stack of `<` comparisons against published edges, so
 * the only values that can be wrong are the edges themselves — a reading of 39
 * and a reading of 5 exercise the same branch. Every case below is either an
 * edge, the value one step under it, or a documented no-data case.
 *
 * The stakes: this is the layer that tells someone with asthma whether to go
 * running. An off-by-one on the wrong side of an edge is a confident, wrong
 * recommendation rather than a crash.
 */

function current(fields: Partial<AirQualityCurrent> = {}): AirQualityCurrent {
  return { time: "2026-09-05T12:00", ...fields };
}

describe("europeanAqiBand", () => {
  it("puts each band edge in the band above it", () => {
    // The EEA defines the edges as exclusive lower bounds of the next band.
    // Getting this backwards moves every reading down one band and is
    // invisible except at exactly these six values.
    expect(europeanAqiBand(0).band).toBe("good");
    expect(europeanAqiBand(19.9).band).toBe("good");
    expect(europeanAqiBand(20).band).toBe("fair");
    expect(europeanAqiBand(39.9).band).toBe("fair");
    expect(europeanAqiBand(40).band).toBe("moderate");
    expect(europeanAqiBand(59.9).band).toBe("moderate");
    expect(europeanAqiBand(60).band).toBe("poor");
    expect(europeanAqiBand(79.9).band).toBe("poor");
    expect(europeanAqiBand(80).band).toBe("very-poor");
    expect(europeanAqiBand(99.9).band).toBe("very-poor");
    expect(europeanAqiBand(100).band).toBe("extremely-poor");
  });

  it("keeps the top band open-ended", () => {
    expect(europeanAqiBand(500).band).toBe("extremely-poor");
    expect(europeanAqiBand(5000).band).toBe("extremely-poor");
  });

  it("maps the six bands onto the four display levels", () => {
    expect(europeanAqiBand(10).level).toBe("low");
    expect(europeanAqiBand(30).level).toBe("low");
    expect(europeanAqiBand(50).level).toBe("moderate");
    expect(europeanAqiBand(70).level).toBe("high");
    expect(europeanAqiBand(90).level).toBe("severe");
    expect(europeanAqiBand(120).level).toBe("severe");
  });

  it("always carries a label and actionable guidance", () => {
    for (const aqi of [0, 20, 40, 60, 80, 100]) {
      const reading = europeanAqiBand(aqi);
      expect(reading.label).not.toBe("");
      expect(reading.guidance).not.toBe("");
    }
  });

  it("reads a missing or nonsensical index as good rather than throwing", () => {
    expect(europeanAqiBand(Number.NaN).band).toBe("good");
    expect(europeanAqiBand(-1).band).toBe("good");
  });
});

describe("pollutantSubIndex", () => {
  it("returns the band ceiling at each published breakpoint", () => {
    // PM2.5 breakpoints are 10/20/25/50/75, and the index tops are 20/40/60/80/100.
    expect(pollutantSubIndex("pm2_5", 10)).toBeCloseTo(20);
    expect(pollutantSubIndex("pm2_5", 20)).toBeCloseTo(40);
    expect(pollutantSubIndex("pm2_5", 25)).toBeCloseTo(60);
    expect(pollutantSubIndex("pm2_5", 50)).toBeCloseTo(80);
    expect(pollutantSubIndex("pm2_5", 75)).toBeCloseTo(100);
  });

  it("interpolates linearly inside a band", () => {
    // Half way from 10 to 20 µg/m³ is half way from index 20 to index 40.
    expect(pollutantSubIndex("pm2_5", 15)).toBeCloseTo(30);
    // PM10: 20 µg/m³ is index 20, 40 is index 40, so 30 sits at 30.
    expect(pollutantSubIndex("pm10", 30)).toBeCloseTo(30);
  });

  it("uses a different scale per pollutant", () => {
    // 100 µg/m³ is the very top of the good band for SO2 and deep into the
    // poor band for PM10. Sharing one table across pollutants is the bug this
    // guards.
    expect(pollutantSubIndex("sulphur_dioxide", 100)).toBeCloseTo(20);
    expect(pollutantSubIndex("pm10", 100)).toBeCloseTo(80);
  });

  it("clamps above the top breakpoint instead of extrapolating", () => {
    expect(pollutantSubIndex("pm2_5", 800)).toBe(150);
    expect(pollutantSubIndex("pm2_5", 100000)).toBe(150);
  });

  it("treats zero, negative and non-finite concentrations as no contribution", () => {
    expect(pollutantSubIndex("ozone", 0)).toBe(0);
    expect(pollutantSubIndex("ozone", -5)).toBe(0);
    expect(pollutantSubIndex("ozone", Number.NaN)).toBe(0);
  });
});

describe("dominantPollutant", () => {
  it("picks the worst sub-index, not the largest concentration", () => {
    // SO2 reads far higher in µg/m³ but is barely off the floor of its own
    // scale; PM2.5 at 40 is deep in the poor band. Ranking by raw
    // concentration would name the wrong pollutant on most city days.
    const worst = dominantPollutant(
      current({ pm2_5: 40, sulphur_dioxide: 90 }),
    );

    expect(worst?.pollutant).toBe("pm2_5");
    expect(worst?.label).toBe("PM2.5");
    expect(worst?.concentration).toBe(40);
    expect(worst?.subIndex).toBeGreaterThan(60);
  });

  it("ignores carbon monoxide, which the European index does not include", () => {
    const worst = dominantPollutant(
      current({ carbon_monoxide: 9000, ozone: 60 }),
    );

    expect(worst?.pollutant).toBe("ozone");
  });

  it("returns null when the payload carries none of the five", () => {
    expect(dominantPollutant(current({ uv_index: 7 }))).toBeNull();
    expect(dominantPollutant(current())).toBeNull();
    expect(dominantPollutant(undefined)).toBeNull();
  });
});

describe("uvBand", () => {
  it("puts each WHO edge in the band above it", () => {
    expect(uvBand(0).band).toBe("low");
    expect(uvBand(2.9).band).toBe("low");
    expect(uvBand(3).band).toBe("moderate");
    expect(uvBand(5.9).band).toBe("moderate");
    expect(uvBand(6).band).toBe("high");
    expect(uvBand(7.9).band).toBe("high");
    expect(uvBand(8).band).toBe("very-high");
    expect(uvBand(10.9).band).toBe("very-high");
    expect(uvBand(11).band).toBe("extreme");
    expect(uvBand(15).band).toBe("extreme");
  });

  it("maps the five WHO bands onto the four display levels", () => {
    expect(uvBand(1).level).toBe("low");
    expect(uvBand(4).level).toBe("moderate");
    expect(uvBand(7).level).toBe("high");
    expect(uvBand(9).level).toBe("severe");
    expect(uvBand(12).level).toBe("severe");
  });

  it("derives a burn time that shortens as the index climbs", () => {
    // 10000/uv seconds, in minutes. These are the same figures the published
    // burn-time tables give, because they come from the same two constants.
    expect(uvBand(3).burnMinutes).toBe(56);
    expect(uvBand(6).burnMinutes).toBe(28);
    expect(uvBand(8).burnMinutes).toBe(21);
    expect(uvBand(11).burnMinutes).toBe(15);
  });

  it("omits a burn time below UV 1, where the figure would be meaningless", () => {
    expect(uvBand(0).burnMinutes).toBeUndefined();
    expect(uvBand(0.9).burnMinutes).toBeUndefined();
    expect(uvBand(1).burnMinutes).toBe(167);
  });

  it("reads a missing or nonsensical index as low rather than throwing", () => {
    expect(uvBand(Number.NaN).band).toBe("low");
    expect(uvBand(-3).band).toBe("low");
    expect(uvBand(Number.NaN).burnMinutes).toBeUndefined();
  });
});

describe("pollenBand", () => {
  it("puts each Met Office edge in the band above it", () => {
    expect(pollenBand(0).band).toBe("none");
    expect(pollenBand(0.1).band).toBe("low");
    expect(pollenBand(29.9).band).toBe("low");
    expect(pollenBand(30).band).toBe("moderate");
    expect(pollenBand(49.9).band).toBe("moderate");
    expect(pollenBand(50).band).toBe("high");
    expect(pollenBand(149.9).band).toBe("high");
    expect(pollenBand(150).band).toBe("very-high");
    expect(pollenBand(2000).band).toBe("very-high");
  });

  it("separates a true zero from a low count", () => {
    // "None" and "low" produce different guidance: one says there is nothing
    // in the air, the other says there is some and you probably will not
    // notice. Collapsing them loses the distinction a sufferer acts on.
    expect(pollenBand(0).label).toBe("None");
    expect(pollenBand(1).label).toBe("Low");
    expect(pollenBand(0).guidance).not.toBe(pollenBand(1).guidance);
  });

  it("maps the five bands onto the four display levels", () => {
    expect(pollenBand(0).level).toBe("low");
    expect(pollenBand(10).level).toBe("low");
    expect(pollenBand(35).level).toBe("moderate");
    expect(pollenBand(100).level).toBe("high");
    expect(pollenBand(200).level).toBe("severe");
  });

  it("reads a nonsensical count as none rather than throwing", () => {
    expect(pollenBand(Number.NaN).band).toBe("none");
    expect(pollenBand(-4).band).toBe("none");
  });
});

describe("pollenReadings", () => {
  it("returns the species present, worst first", () => {
    const readings = pollenReadings(
      current({ grass_pollen: 12, birch_pollen: 180, olive_pollen: 45 }),
    );

    expect(readings.map((r) => r.species)).toEqual([
      "birch_pollen",
      "olive_pollen",
      "grass_pollen",
    ]);
    expect(readings[0].band).toBe("very-high");
    expect(readings[0].speciesLabel).toBe("Birch");
  });

  it("keeps a reported zero, which is a real answer", () => {
    const readings = pollenReadings(current({ ragweed_pollen: 0 }));

    expect(readings).toHaveLength(1);
    expect(readings[0].band).toBe("none");
  });

  it("returns empty outside the Europe-only pollen domain", () => {
    // Absent fields mean "not covered at this coordinate", which the panel
    // renders as a hidden section — not as a row of zeroes claiming clear air.
    expect(pollenReadings(current({ pm2_5: 8, uv_index: 5 }))).toEqual([]);
    expect(pollenReadings(undefined)).toEqual([]);
  });

  it("drops a null the API sent in place of a number", () => {
    const readings = pollenReadings(
      current({
        grass_pollen: null as unknown as number,
        birch_pollen: 20,
      }),
    );

    expect(readings.map((r) => r.species)).toEqual(["birch_pollen"]);
  });
});
