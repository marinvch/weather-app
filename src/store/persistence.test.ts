import { describe, it, expect } from "vitest";

import {
  STORAGE_KEY,
  STORAGE_VERSION,
  loadPersistedState,
  parsePersistedState,
  savePersistedState,
  selectPersistedState,
  type PersistableState,
  type StorageLike,
} from "@/store/persistence";
import { initialPreferencesState } from "@/store/slices/preferencesSlice";
import { initialUserProfileState } from "@/store/slices/userProfileSlice";

/**
 * Hydration is the code that breaks silently in production: the blob outlives
 * the build that wrote it, nobody clears localStorage, and a bad value reaches
 * a reducer as `preloadedState` — before any component could guard against it.
 * So every case here is "what someone's browser already has stored", not "what
 * this version writes".
 */

function memoryStorage(seed: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const validState: PersistableState = {
  userProfile: {
    ...initialUserProfileState,
    profile: "marine",
    units: "imperial",
    location: { latitude: 42.6967, longitude: 27.2695 },
    locationName: "Medenrudnik, Burgas, Bulgaria",
  },
  preferences: {
    ...initialPreferencesState,
    theme: "dark",
    alertSensitivity: "high",
    favoriteLocations: [
      { id: "42.6967,27.2695", name: "Home", latitude: 42.6967, longitude: 27.2695 },
    ],
  },
};

function stored(payload: unknown): string {
  return JSON.stringify(payload);
}

describe("parsePersistedState", () => {
  it("round-trips a payload this version wrote", () => {
    const hydrated = parsePersistedState(
      stored(selectPersistedState(validState)),
    );

    expect(hydrated.userProfile.profile).toBe("marine");
    expect(hydrated.userProfile.units).toBe("imperial");
    expect(hydrated.userProfile.location).toEqual({
      latitude: 42.6967,
      longitude: 27.2695,
    });
    expect(hydrated.userProfile.locationName).toBe(
      "Medenrudnik, Burgas, Bulgaria",
    );
    expect(hydrated.preferences.theme).toBe("dark");
    expect(hydrated.preferences.alertSensitivity).toBe("high");
    expect(hydrated.preferences.favoriteLocations).toHaveLength(1);
  });

  it("falls back to defaults when there is nothing stored", () => {
    expect(parsePersistedState(null)).toEqual({
      userProfile: initialUserProfileState,
      preferences: initialPreferencesState,
    });
  });

  it("falls back to defaults on malformed JSON rather than throwing", () => {
    expect(() => parsePersistedState("{not json")).not.toThrow();
    expect(parsePersistedState("{not json").userProfile).toEqual(
      initialUserProfileState,
    );
    // A truncated write — the tab died mid-setItem.
    expect(parsePersistedState('{"version":1,"userProfile":{"pro').preferences).toEqual(
      initialPreferencesState,
    );
  });

  it("falls back to defaults when the payload is not an object", () => {
    expect(parsePersistedState('"marine"').userProfile).toEqual(
      initialUserProfileState,
    );
    expect(parsePersistedState("42").userProfile).toEqual(
      initialUserProfileState,
    );
    expect(parsePersistedState("null").userProfile).toEqual(
      initialUserProfileState,
    );
    expect(parsePersistedState("[1,2,3]").userProfile).toEqual(
      initialUserProfileState,
    );
  });

  it("discards a payload written by an incompatible version", () => {
    const old = stored({
      version: STORAGE_VERSION + 1,
      userProfile: { profile: "marine" },
      preferences: { theme: "dark" },
    });

    expect(parsePersistedState(old).userProfile.profile).toBe("general");
    expect(parsePersistedState(old).preferences.theme).toBe("system");
  });

  it("discards a payload with no version at all", () => {
    const unversioned = stored({
      userProfile: { profile: "marine" },
      preferences: { theme: "dark" },
    });

    expect(parsePersistedState(unversioned).userProfile.profile).toBe("general");
  });

  it("keeps the fields it recognises when whole sections are missing", () => {
    const partial = stored({
      version: STORAGE_VERSION,
      preferences: { theme: "light" },
    });

    const hydrated = parsePersistedState(partial);
    expect(hydrated.preferences.theme).toBe("light");
    // Untouched sections and unpersisted fields keep their initial values.
    expect(hydrated.userProfile).toEqual(initialUserProfileState);
    expect(hydrated.preferences.refreshInterval).toBe(
      initialPreferencesState.refreshInterval,
    );
  });

  it("rejects values outside each union, field by field", () => {
    const bogus = stored({
      version: STORAGE_VERSION,
      userProfile: {
        profile: "astronaut",
        units: "furlongs",
        locationName: 42,
      },
      preferences: { theme: "neon", alertSensitivity: "extreme" },
    });

    const hydrated = parsePersistedState(bogus);
    expect(hydrated.userProfile.profile).toBe("general");
    expect(hydrated.userProfile.units).toBe("metric");
    expect(hydrated.userProfile.locationName).toBe("");
    expect(hydrated.preferences.theme).toBe("system");
    expect(hydrated.preferences.alertSensitivity).toBe("medium");
  });

  it("does not mistake an inherited property for a stored value", () => {
    // "constructor" is on every object's prototype chain; a plain `in` check
    // would accept it as a valid profile and blow up the registry lookup.
    const hydrated = parsePersistedState(
      stored({
        version: STORAGE_VERSION,
        userProfile: { profile: "constructor" },
        preferences: {},
      }),
    );

    expect(hydrated.userProfile.profile).toBe("general");
  });

  it("drops a location that is not a WGS 84 pair at all", () => {
    const cases = [
      { latitude: "42.7", longitude: "27.3" },
      { latitude: 42.7 },
      { longitude: 27.3 },
      {},
      null,
      "42.6967,27.2695",
      [42.6967, 27.2695],
    ];

    for (const location of cases) {
      const hydrated = parsePersistedState(
        stored({
          version: STORAGE_VERSION,
          userProfile: { location },
          preferences: {},
        }),
      );
      expect(hydrated.userProfile.location).toBeNull();
    }
  });

  it("normalizes a stored pair that has drifted out of range", () => {
    const wrapped = parsePersistedState(
      stored({
        version: STORAGE_VERSION,
        userProfile: { location: { latitude: 42.6967, longitude: 187 } },
        preferences: {},
      }),
    );

    // 187 is 173 west of the antimeridian, not an error — same rule Leaflet
    // drags go through. Latitude clamps rather than wrapping.
    expect(wrapped.userProfile.location).toEqual({
      latitude: 42.6967,
      longitude: -173,
    });

    const clamped = parsePersistedState(
      stored({
        version: STORAGE_VERSION,
        userProfile: { location: { latitude: 91, longitude: 27.2695 } },
        preferences: {},
      }),
    );

    expect(clamped.userProfile.location).toEqual({
      latitude: 90,
      longitude: 27.2695,
    });
  });

  it("filters bad favourites instead of discarding the whole list", () => {
    const hydrated = parsePersistedState(
      stored({
        version: STORAGE_VERSION,
        userProfile: {},
        preferences: {
          favoriteLocations: [
            { id: "a", name: "Good", latitude: 42, longitude: 27 },
            { id: "", name: "No id", latitude: 42, longitude: 27 },
            { id: "b", name: 7, latitude: 42, longitude: 27 },
            { id: "c", name: "Coords as strings", latitude: "42", longitude: "27" },
            { id: "d", name: "No coords" },
            "not an object",
            null,
            { id: "a", name: "Duplicate id", latitude: 1, longitude: 1 },
          ],
        },
      }),
    );

    expect(hydrated.preferences.favoriteLocations).toEqual([
      { id: "a", name: "Good", latitude: 42, longitude: 27 },
    ]);
  });

  it("falls back to an empty list when favourites are not an array", () => {
    const hydrated = parsePersistedState(
      stored({
        version: STORAGE_VERSION,
        userProfile: {},
        preferences: { favoriteLocations: { a: 1 } },
      }),
    );

    expect(hydrated.preferences.favoriteLocations).toEqual([]);
  });
});

describe("loadPersistedState", () => {
  it("reads the payload under the versioned key", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: stored(selectPersistedState(validState)),
    });

    expect(loadPersistedState(storage).userProfile.profile).toBe("marine");
  });

  it("returns defaults when there is no storage at all", () => {
    expect(loadPersistedState(null).userProfile).toEqual(
      initialUserProfileState,
    );
  });

  it("returns defaults when reading storage throws", () => {
    // Some privacy modes throw on access rather than returning null.
    const hostile: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
      removeItem: () => {},
    };

    expect(() => loadPersistedState(hostile)).not.toThrow();
    expect(loadPersistedState(hostile).preferences).toEqual(
      initialPreferencesState,
    );
  });
});

describe("savePersistedState", () => {
  it("writes only the allow-listed fields", () => {
    const storage = memoryStorage();
    savePersistedState(validState, storage);

    const written = JSON.parse(storage.getItem(STORAGE_KEY) as string);

    expect(written.version).toBe(STORAGE_VERSION);
    expect(Object.keys(written).sort()).toEqual([
      "preferences",
      "userProfile",
      "version",
    ]);
    expect(Object.keys(written.userProfile).sort()).toEqual([
      "location",
      "locationName",
      "profile",
      "units",
    ]);
    expect(Object.keys(written.preferences).sort()).toEqual([
      "alertSensitivity",
      "favoriteLocations",
      "theme",
    ]);
  });

  it("never carries an RTK Query cache across a reload", () => {
    // The whole reason this is an allow-list: a rehydrated cache is a forecast
    // from an unknown point in the past, shown as current.
    const withCaches = {
      ...validState,
      openMeteo: { queries: { "forecast(42)": { data: { stale: true } } } },
      marine: { queries: {} },
    } as unknown as PersistableState;

    const storage = memoryStorage();
    savePersistedState(withCaches, storage);

    const raw = storage.getItem(STORAGE_KEY) as string;
    expect(raw).not.toContain("openMeteo");
    expect(raw).not.toContain("queries");
  });

  it("swallows a quota error rather than breaking the dispatch that caused it", () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };

    expect(() => savePersistedState(validState, full)).not.toThrow();
  });

  it("does nothing when there is no storage", () => {
    // Server-side render, or a browser that throws on localStorage access.
    expect(() => savePersistedState(validState, null)).not.toThrow();
  });

  it("survives a full write/read round trip", () => {
    const storage = memoryStorage();
    savePersistedState(validState, storage);

    expect(loadPersistedState(storage)).toEqual({
      userProfile: validState.userProfile,
      preferences: validState.preferences,
    });
  });
});
