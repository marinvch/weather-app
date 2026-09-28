import { describe, it, expect } from "vitest";
import { formatPlaceName, placeKey, placeSecondaryText } from "./places";
import type { GeocodingResult } from "@/shared/types/weather";

function place(fields: Partial<GeocodingResult> = {}): GeocodingResult {
  return {
    id: 1,
    name: "Burgas",
    latitude: 42.5061,
    longitude: 27.4678,
    country: "Bulgaria",
    admin1: "Burgas Province",
    ...fields,
  };
}

describe("formatPlaceName", () => {
  it("joins name, region and country", () => {
    expect(formatPlaceName(place())).toBe("Burgas, Burgas Province, Bulgaria");
  });

  it("drops a region that repeats the name", () => {
    // City-states hit this constantly, and "Berlin, Berlin, Germany" reads as
    // a rendering bug rather than a place.
    expect(
      formatPlaceName(place({ name: "Berlin", admin1: "Berlin", country: "Germany" })),
    ).toBe("Berlin, Germany");
  });

  it("drops a country that repeats the name", () => {
    expect(
      formatPlaceName(
        place({ name: "Singapore", admin1: undefined, country: "Singapore" }),
      ),
    ).toBe("Singapore");
  });

  it("survives a result with neither region nor country", () => {
    expect(
      formatPlaceName(
        place({ name: "Rockall", admin1: undefined, country: undefined }),
      ),
    ).toBe("Rockall");
  });
});

describe("placeSecondaryText", () => {
  it("carries the disambiguating parts and not the name", () => {
    expect(placeSecondaryText(place())).toBe("Burgas Province, Bulgaria");
  });

  it("prefers admin1 over admin2 rather than showing both", () => {
    expect(
      placeSecondaryText(
        place({
          name: "Springfield",
          admin1: "Illinois",
          admin2: "Sangamon County",
          country: "United States",
        }),
      ),
    ).toBe("Illinois, United States");
  });

  it("falls back to admin2 when there is no admin1", () => {
    expect(
      placeSecondaryText(
        place({
          name: "Springfield",
          admin1: undefined,
          admin2: "Sangamon County",
          country: "United States",
        }),
      ),
    ).toBe("Sangamon County, United States");
  });

  it("is empty when there is nothing to disambiguate with", () => {
    expect(
      placeSecondaryText(
        place({ name: "Rockall", admin1: undefined, admin2: undefined, country: undefined }),
      ),
    ).toBe("");
  });

  it("does not repeat a part that appears twice", () => {
    expect(
      placeSecondaryText(
        place({ name: "Luxembourg", admin1: "Luxembourg", country: "Luxembourg" }),
      ),
    ).toBe("");
  });
});

describe("placeKey", () => {
  it("separates two places that share an id", () => {
    const a = place({ id: 7, latitude: 42.5, longitude: 27.4 });
    const b = place({ id: 7, latitude: 51.5, longitude: -0.1 });

    expect(placeKey(a)).not.toBe(placeKey(b));
  });

  it("is stable for the same place", () => {
    expect(placeKey(place())).toBe(placeKey(place()));
  });
});
