import { describe, it, expect, vi } from "vitest";
import {
  getEmergencyNumber,
  getLocationInfo,
  isCoastalLocation,
  isMountainousLocation,
} from "./geolocation";

/** Build a Nominatim-shaped reverse-geocode payload. */
function nominatimResponse(address: Record<string, string>, displayName = "") {
  return {
    ok: true,
    json: async () => ({ address, display_name: displayName }),
  } as unknown as Response;
}

describe("getEmergencyNumber", () => {
  it("returns the country's own number when the country is known", () => {
    expect(getEmergencyNumber("BG", "police")).toBe("166");
    expect(getEmergencyNumber("BG", "medical")).toBe("150");
    expect(getEmergencyNumber("GB", "police")).toBe("999");
    expect(getEmergencyNumber("JP", "medical")).toBe("119");
  });

  it("falls back to 112 for a country not in the table", () => {
    // Brazil is not listed; the DEFAULT entry must answer rather than undefined.
    expect(getEmergencyNumber("BR", "police")).toBe("112");
    expect(getEmergencyNumber("BR", "general")).toBe("112");
  });

  it("treats an empty or unknown code as DEFAULT rather than throwing", () => {
    expect(getEmergencyNumber("", "general")).toBe("112");
    expect(getEmergencyNumber("DEFAULT", "fire")).toBe("112");
  });

  it("is case sensitive, so callers must pass an upper-case ISO code", () => {
    // getLocationInfo upper-cases Nominatim's lower-case country_code before
    // calling this. A lower-case code silently degrades to DEFAULT instead of
    // erroring, which is exactly how a wrong number would reach a user.
    expect(getEmergencyNumber("bg", "police")).toBe("112");
    expect(getEmergencyNumber("BG", "police")).toBe("166");
  });

  it("falls back to the general number for a profile-specific type a country omits", () => {
    // maritime and mountain are optional on EmergencyNumbers.
    expect(getEmergencyNumber("US", "mountain")).toBe("911");
    expect(getEmergencyNumber("BR", "maritime")).toBe("112");
  });
});

describe("getLocationInfo", () => {
  const sofia = { latitude: 42.6977, longitude: 27.2695 };

  it("maps a Nominatim response to a LocationInfo with the country's numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        nominatimResponse({
          city: "Burgas",
          state: "Burgas Province",
          country: "Bulgaria",
          country_code: "bg",
        }),
      ),
    );

    const info = await getLocationInfo(sofia);

    expect(info.city).toBe("Burgas");
    expect(info.country).toBe("Bulgaria");
    // country_code arrives lower-case from Nominatim and must be upper-cased.
    expect(info.countryCode).toBe("BG");
    expect(info.displayName).toBe("Burgas, Burgas Province, Bulgaria");
    expect(info.emergencyNumbers.police).toBe("166");
  });

  it("omits the region from displayName when Nominatim gives none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        nominatimResponse({
          city: "Gibraltar",
          country: "Gibraltar",
          country_code: "gi",
        }),
      ),
    );

    const info = await getLocationInfo({ latitude: 36.14, longitude: -5.35 });

    expect(info.displayName).toBe("Gibraltar, Gibraltar");
  });

  it("falls back through town/village when no city is present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        nominatimResponse({
          village: "Chamonix",
          country: "France",
          country_code: "fr",
        }),
      ),
    );

    const info = await getLocationInfo({ latitude: 45.92, longitude: 6.87 });

    expect(info.city).toBe("Chamonix");
    expect(info.emergencyNumbers.mountain).toBe("112 / PGHM");
  });

  it("degrades to coordinates and DEFAULT numbers when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    // The implementation logs the failure; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});

    const info = await getLocationInfo(sofia);

    expect(info.city).toBe("Unknown");
    expect(info.countryCode).toBe("DEFAULT");
    expect(info.displayName).toBe("42.6977, 27.2695");
    expect(info.emergencyNumbers.general).toBe("112");
  });

  it("degrades the same way when the geocoder answers with a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }) as unknown as Response),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const info = await getLocationInfo(sofia);

    expect(info.countryCode).toBe("DEFAULT");
    expect(info.emergencyNumbers.general).toBe("112");
  });
});

describe("isCoastalLocation / isMountainousLocation", () => {
  it("recognises locations inside the declared boxes", () => {
    expect(isCoastalLocation({ latitude: 36.14, longitude: -5.35 })).toBe(true);
    expect(isMountainousLocation({ latitude: 45.92, longitude: 6.87 })).toBe(
      true,
    );
  });

  it("rejects a location outside every box", () => {
    // Central Siberia is in none of the listed regions.
    expect(isCoastalLocation({ latitude: 62, longitude: 100 })).toBe(false);
    expect(isMountainousLocation({ latitude: 62, longitude: 100 })).toBe(false);
  });

  it("documents that these are coarse bounding boxes, not real geography", () => {
    // Madrid is inland but sits inside the Mediterranean box, so it reads as
    // coastal. This is a known limitation of the heuristic, asserted here so a
    // future change to it is a deliberate decision rather than a surprise.
    expect(isCoastalLocation({ latitude: 40.42, longitude: -3.7 })).toBe(true);
  });
});

describe("getLocationInfo — request shape", () => {
  it("sends no custom headers, so the request stays CORS-simple", async () => {
    // Regression guard. This once sent a User-Agent header, which browsers
    // forbid scripts from setting and which made the request non-simple —
    // triggering a CORS preflight Nominatim rejects. Every lookup failed and
    // silently fell back, so the app always showed its hardcoded default
    // location. Any header added here reintroduces that.
    const fetchMock = vi.fn(async () =>
      nominatimResponse({ city: "Burgas", country: "Bulgaria", country_code: "bg" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getLocationInfo({ latitude: 42.7, longitude: 27.27 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit | undefined,
    ];
    expect(url).toContain("nominatim.openstreetmap.org/reverse");
    expect(init?.headers).toBeUndefined();
  });
});
