/**
 * localStorage persistence for the two preference slices — and only those two.
 *
 * What is persisted is an explicit allow-list, not the store. Serialising the
 * whole state would carry the RTK Query caches with it, and a rehydrated cache
 * is a forecast from an unknown point in the past presented as current: the one
 * kind of stale this app must never show. The API slices are re-fetched on boot,
 * always.
 *
 * Everything read back is treated as hostile. The blob outlives the code that
 * wrote it — an older release, a hand-edited value, a half-written record from a
 * tab killed mid-write — so every field is validated before it reaches a
 * reducer, and anything that fails falls back to the slice's own initial value
 * rather than throwing. A malformed blob costs the user their preferences; it
 * must never cost them the app.
 */

import { isValidCoordinates, normalizeCoordinates } from "@/shared/lib/geo";
import type {
  Coordinates,
  UserPreferences,
  UserProfile,
} from "@/shared/types/weather";
import {
  initialPreferencesState,
  type AppPreferences,
  type FavoriteLocation,
} from "@/store/slices/preferencesSlice";
import { initialUserProfileState } from "@/store/slices/userProfileSlice";

export const STORAGE_KEY = "weather-pro:state";

/**
 * Bump when the shape below changes incompatibly. A stored payload carrying any
 * other version is discarded whole rather than migrated — there is nothing here
 * worth a migration path, and a wrong guess at an old shape is worse than a
 * reset to defaults.
 */
export const STORAGE_VERSION = 1;

/** The slice of `userProfile` worth surviving a refresh. */
export type PersistedUserProfile = Pick<
  UserPreferences,
  "profile" | "units" | "location" | "locationName"
>;

/** The slice of `preferences` worth surviving a refresh. */
export type PersistedPreferences = Pick<
  AppPreferences,
  "theme" | "favoriteLocations" | "alertSensitivity"
>;

export interface PersistedState {
  version: number;
  userProfile: PersistedUserProfile;
  preferences: PersistedPreferences;
}

/** What `configureStore` is handed as `preloadedState`. Both keys, always. */
export interface HydratedState {
  userProfile: UserPreferences;
  preferences: AppPreferences;
}

/** The state this module can read from and write for. `RootState` satisfies it
 * structurally, which is what keeps this file from importing the store it is
 * installed into. */
export interface PersistableState {
  userProfile: UserPreferences;
  preferences: AppPreferences;
}

/** The parts of `Storage` used here, so a test can pass a plain object. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Accessing `window.localStorage` *throws* in some privacy modes rather than
 * returning null, so even reaching for it is guarded.
 */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * The string unions, as runtime lookups.
 *
 * `Record<T, true>` rather than an array: adding a member to `UserProfile` (a
 * fifth persona) or to the theme union stops compiling here until it is listed,
 * so the validator cannot silently start rejecting a value the app now accepts.
 *
 * The profile list is duplicated from `@/app/profiles` on purpose — the store
 * must not depend on the composition root that mounts it, and both copies are
 * keyed by `UserProfile`, so the compiler holds them in step.
 */
const PROFILES: Record<UserProfile, true> = {
  general: true,
  marine: true,
  mountain: true,
  agriculture: true,
};

const UNITS: Record<UserPreferences["units"], true> = {
  metric: true,
  imperial: true,
};

const THEMES: Record<AppPreferences["theme"], true> = {
  light: true,
  dark: true,
  system: true,
};

const SENSITIVITIES: Record<AppPreferences["alertSensitivity"], true> = {
  low: true,
  medium: true,
  high: true,
};

function isMember<T extends string>(
  members: Record<T, true>,
  value: unknown,
): value is T {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(members, value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A stored coordinate is a coordinate from outside the app, so it normalizes at
 * this boundary like every other one does — WGS 84 decimal degrees, `latitude,
 * longitude`, no conversion, latitude clamped and longitude wrapped.
 *
 * Normalize first, then validate: that way a longitude of 187 becomes -173
 * rather than being thrown away, while NaN, Infinity and anything that is not a
 * number survive neither step and come back null.
 */
function readCoordinates(value: unknown): Coordinates | null {
  if (!isRecord(value)) return null;
  if (typeof value.latitude !== "number") return null;
  if (typeof value.longitude !== "number") return null;

  const normalized = normalizeCoordinates({
    latitude: value.latitude,
    longitude: value.longitude,
  });

  return isValidCoordinates(normalized) ? normalized : null;
}

/**
 * Favourites are filtered, not rejected as a set: one corrupt entry should not
 * cost the user the other nine.
 */
function readFavorites(value: unknown): FavoriteLocation[] | null {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const favorites: FavoriteLocation[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.id !== "string" || entry.id === "") continue;
    if (typeof entry.name !== "string") continue;
    const coordinates = readCoordinates(entry);
    if (!coordinates) continue;
    if (seen.has(entry.id)) continue;

    seen.add(entry.id);
    favorites.push({
      id: entry.id,
      name: entry.name,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
  }

  return favorites;
}

/**
 * Reads one persisted blob into a full preloaded state.
 *
 * Field by field, because a partial record is the common case: a payload
 * written by a build that had not added `alertSensitivity` yet is still worth
 * everything else in it. Each field that fails validation falls back to its
 * slice's initial value.
 */
export function parsePersistedState(raw: string | null): HydratedState {
  const fallback: HydratedState = {
    userProfile: initialUserProfileState,
    preferences: initialPreferencesState,
  };

  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Truncated or hand-mangled JSON. Defaults, silently — there is nothing
    // the user could do about it and nothing worth an error screen.
    return fallback;
  }

  if (!isRecord(parsed)) return fallback;
  if (parsed.version !== STORAGE_VERSION) return fallback;

  const storedProfile = isRecord(parsed.userProfile) ? parsed.userProfile : {};
  const storedPreferences = isRecord(parsed.preferences)
    ? parsed.preferences
    : {};

  const location = readCoordinates(storedProfile.location);
  const favorites = readFavorites(storedPreferences.favoriteLocations);

  return {
    userProfile: {
      ...initialUserProfileState,
      profile: isMember(PROFILES, storedProfile.profile)
        ? storedProfile.profile
        : initialUserProfileState.profile,
      units: isMember(UNITS, storedProfile.units)
        ? storedProfile.units
        : initialUserProfileState.units,
      location,
      locationName:
        typeof storedProfile.locationName === "string"
          ? storedProfile.locationName
          : initialUserProfileState.locationName,
    },
    preferences: {
      ...initialPreferencesState,
      theme: isMember(THEMES, storedPreferences.theme)
        ? storedPreferences.theme
        : initialPreferencesState.theme,
      alertSensitivity: isMember(
        SENSITIVITIES,
        storedPreferences.alertSensitivity,
      )
        ? storedPreferences.alertSensitivity
        : initialPreferencesState.alertSensitivity,
      favoriteLocations: favorites ?? initialPreferencesState.favoriteLocations,
    },
  };
}

/** The preloaded state for `configureStore`. Never throws, never returns partial. */
export function loadPersistedState(
  storage: StorageLike | null = defaultStorage(),
): HydratedState {
  if (!storage) {
    return {
      userProfile: initialUserProfileState,
      preferences: initialPreferencesState,
    };
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }

  return parsePersistedState(raw);
}

/** The allow-list, applied on the way out as well as on the way in. */
export function selectPersistedState(state: PersistableState): PersistedState {
  return {
    version: STORAGE_VERSION,
    userProfile: {
      profile: state.userProfile.profile,
      units: state.userProfile.units,
      location: state.userProfile.location,
      locationName: state.userProfile.locationName,
    },
    preferences: {
      theme: state.preferences.theme,
      favoriteLocations: state.preferences.favoriteLocations,
      alertSensitivity: state.preferences.alertSensitivity,
    },
  };
}

export function savePersistedState(
  state: PersistableState,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(selectPersistedState(state)));
  } catch {
    // Quota exceeded or storage disabled mid-session. Losing a preference is
    // not worth interrupting anyone over.
  }
}
