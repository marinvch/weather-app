import { describe, it, expect } from "vitest";
import {
  celsiusToFahrenheit,
  convertDistance,
  convertPrecip,
  convertSpeed,
  degreesToCardinal,
  fahrenheitToCelsius,
  formatDistance,
  formatPrecip,
  formatSpeed,
  formatTemperature,
  unitsFor,
} from "./units";

describe("temperature conversion", () => {
  it("converts the fixed points", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(-40)).toBe(-40);
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBe(100);
    expect(fahrenheitToCelsius(-40)).toBe(-40);
  });

  it("handles negatives either side of freezing", () => {
    expect(celsiusToFahrenheit(-10)).toBe(14);
    expect(celsiusToFahrenheit(-17.5)).toBeCloseTo(0.5, 10);
  });

  it("round-trips", () => {
    for (const c of [-40, -12.5, 0, 0.1, 21.7, 37, 58]) {
      expect(fahrenheitToCelsius(celsiusToFahrenheit(c))).toBeCloseTo(c, 10);
    }
  });
});

describe("convertSpeed", () => {
  it("returns km/h untouched", () => {
    expect(convertSpeed(37.4, "kmh")).toBe(37.4);
    expect(convertSpeed(0, "kmh")).toBe(0);
  });

  it("uses the exact definitions of the mile, the metre and the nautical mile", () => {
    expect(convertSpeed(1.609344, "mph")).toBeCloseTo(1, 12);
    expect(convertSpeed(3.6, "ms")).toBeCloseTo(1, 12);
    expect(convertSpeed(1.852, "kn")).toBeCloseTo(1, 12);
  });

  it("keeps a gale a gale in every unit", () => {
    // 74 km/h is the low end of Beaufort 8.
    expect(convertSpeed(74, "mph")).toBeCloseTo(45.98, 2);
    expect(convertSpeed(74, "ms")).toBeCloseTo(20.56, 2);
    expect(convertSpeed(74, "kn")).toBeCloseTo(39.96, 2);
  });

  it("leaves zero at zero in every unit", () => {
    for (const unit of ["kmh", "mph", "ms", "kn"] as const) {
      expect(convertSpeed(0, unit)).toBe(0);
    }
  });
});

describe("convertPrecip", () => {
  it("converts on the exact inch", () => {
    expect(convertPrecip(25.4, "in")).toBeCloseTo(1, 12);
    expect(convertPrecip(0, "in")).toBe(0);
    expect(convertPrecip(2.5, "mm")).toBe(2.5);
  });
});

describe("convertDistance", () => {
  it("converts on the exact mile", () => {
    expect(convertDistance(1.609344, "mi")).toBeCloseTo(1, 12);
    expect(convertDistance(42, "km")).toBe(42);
  });
});

describe("formatTemperature", () => {
  it("rounds to whole degrees and names the scale", () => {
    expect(formatTemperature(21.4, "c")).toBe("21°C");
    expect(formatTemperature(21.6, "c")).toBe("22°C");
    expect(formatTemperature(21.4, "f")).toBe("71°F");
  });

  it("never renders a negative zero", () => {
    // (-0).toFixed(0) is "-0", so -0.3°C would otherwise display as "-0°C".
    expect(formatTemperature(-0.3, "c")).toBe("0°C");
    expect(formatTemperature(-0.4, "c")).not.toContain("-");
    expect(formatTemperature(-0.01, "c", { decimals: 1 })).toBe("0.0°C");
  });

  it("formats hard negatives correctly", () => {
    expect(formatTemperature(-12, "c")).toBe("-12°C");
    expect(formatTemperature(-12, "f")).toBe("10°F");
    expect(formatTemperature(-40, "f")).toBe("-40°F");
  });

  it("honours decimals, scale suppression and signing", () => {
    expect(formatTemperature(21.44, "c", { decimals: 1 })).toBe("21.4°C");
    expect(formatTemperature(21.4, "c", { showScale: false })).toBe("21°");
    expect(formatTemperature(3.2, "c", { signed: true })).toBe("+3°C");
    expect(formatTemperature(-3.2, "c", { signed: true })).toBe("-3°C");
    // A rounded-to-zero anomaly is neither above nor below normal, so it gets
    // no sign even though the raw value is positive.
    expect(formatTemperature(0.2, "c", { signed: true })).toBe("0°C");
  });

  it("degrades to a placeholder rather than printing NaN", () => {
    expect(formatTemperature(Number.NaN, "c")).toBe("--°");
    expect(formatTemperature(Number.POSITIVE_INFINITY, "f")).toBe("--°");
  });
});

describe("formatSpeed", () => {
  it("labels each unit and picks its resolution", () => {
    expect(formatSpeed(37.4, "kmh")).toBe("37 km/h");
    expect(formatSpeed(37.4, "mph")).toBe("23 mph");
    expect(formatSpeed(37.4, "ms")).toBe("10.4 m/s");
    expect(formatSpeed(37.4, "kn")).toBe("20 kn");
  });

  it("shows a dead calm as zero, not as blank", () => {
    expect(formatSpeed(0, "kmh")).toBe("0 km/h");
    expect(formatSpeed(0, "ms")).toBe("0.0 m/s");
  });

  it("degrades to a placeholder rather than printing NaN", () => {
    expect(formatSpeed(Number.NaN, "kn")).toBe("-- kn");
  });
});

describe("formatPrecip", () => {
  it("keeps a tenth of a millimetre visible", () => {
    expect(formatPrecip(0.4, "mm")).toBe("0.4 mm");
    expect(formatPrecip(12, "mm")).toBe("12.0 mm");
  });

  it("uses two decimals in inches so drizzle is not rounded away", () => {
    // 0.4 mm is 0.0157 in — at one decimal this whole category reads "0.0 in".
    expect(formatPrecip(0.4, "in")).toBe("0.02 in");
    expect(formatPrecip(25.4, "in")).toBe("1.00 in");
    expect(formatPrecip(0, "in")).toBe("0.00 in");
  });

  it("degrades to a placeholder rather than printing NaN", () => {
    expect(formatPrecip(Number.NaN, "mm")).toBe("-- mm");
  });
});

describe("formatDistance", () => {
  it("keeps a decimal under 10 and drops it above", () => {
    expect(formatDistance(2.34, "km")).toBe("2.3 km");
    expect(formatDistance(42.4, "km")).toBe("42 km");
    expect(formatDistance(16.09344, "mi")).toBe("10 mi");
  });
});

describe("degreesToCardinal", () => {
  it("names the eight principal points", () => {
    expect(degreesToCardinal(0)).toBe("N");
    expect(degreesToCardinal(45)).toBe("NE");
    expect(degreesToCardinal(90)).toBe("E");
    expect(degreesToCardinal(135)).toBe("SE");
    expect(degreesToCardinal(180)).toBe("S");
    expect(degreesToCardinal(225)).toBe("SW");
    expect(degreesToCardinal(270)).toBe("W");
    expect(degreesToCardinal(315)).toBe("NW");
  });

  it("names the sixteenth points", () => {
    expect(degreesToCardinal(22.5)).toBe("NNE");
    expect(degreesToCardinal(67.5)).toBe("ENE");
    expect(degreesToCardinal(112.5)).toBe("ESE");
    expect(degreesToCardinal(157.5)).toBe("SSE");
    expect(degreesToCardinal(202.5)).toBe("SSW");
    expect(degreesToCardinal(247.5)).toBe("WSW");
    expect(degreesToCardinal(292.5)).toBe("WNW");
    expect(degreesToCardinal(337.5)).toBe("NNW");
  });

  it("wraps back to north across the 348.75 boundary", () => {
    // The bug this guards: without the trailing % 16 the lookup is undefined
    // for the last half-sector before due north.
    expect(degreesToCardinal(348.74)).toBe("NNW");
    expect(degreesToCardinal(348.75)).toBe("N");
    expect(degreesToCardinal(355)).toBe("N");
    expect(degreesToCardinal(359.9)).toBe("N");
    expect(degreesToCardinal(360)).toBe("N");
  });

  it("splits each sector at its own boundary", () => {
    expect(degreesToCardinal(11.24)).toBe("N");
    expect(degreesToCardinal(11.25)).toBe("NNE");
    expect(degreesToCardinal(33.75)).toBe("NE");
  });

  it("normalizes out-of-range bearings instead of returning undefined", () => {
    expect(degreesToCardinal(450)).toBe("E");
    expect(degreesToCardinal(720)).toBe("N");
    expect(degreesToCardinal(-90)).toBe("W");
    expect(degreesToCardinal(-450)).toBe("W");
  });

  it("degrades to a placeholder rather than returning undefined", () => {
    expect(degreesToCardinal(Number.NaN)).toBe("--");
  });
});

describe("unitsFor", () => {
  it("resolves all four units from one preference", () => {
    expect(unitsFor("metric")).toEqual({
      temperature: "c",
      speed: "kmh",
      precipitation: "mm",
      distance: "km",
    });
    expect(unitsFor("imperial")).toEqual({
      temperature: "f",
      speed: "mph",
      precipitation: "in",
      distance: "mi",
    });
  });

  it("never resolves to knots — that is a marine choice, not an imperial one", () => {
    expect(unitsFor("imperial").speed).not.toBe("kn");
    expect(unitsFor("metric").speed).not.toBe("kn");
  });
});
