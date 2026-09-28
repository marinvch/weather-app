/**
 * The profile registry — the one place that knows what a Profile *is*.
 *
 * A Profile is a lens, not an account: it selects which API is queried, which
 * dashboard renders and which analysis runs, and it grants nothing. See
 * `CONTEXT.md`.
 *
 * This used to be three parallel lists — the `UserProfile` union, a `switch` in
 * `App.tsx` and a label/icon map in `ProfileSelector` — of which the compiler
 * checked two. Adding a fifth persona is now: extend the union in
 * `@/shared/types/weather`, then add one entry here. Everything else follows,
 * because `Record<UserProfile, …>` makes the missing entry a compile error.
 *
 * It lives in `src/app/` because it is the only kind of knowledge the
 * composition root is allowed to hold: which features exist and how they fit
 * together. A feature must never import it.
 */

import { lazy, type ComponentType, type ReactNode } from "react";
import PeopleIcon from "@mui/icons-material/People";
import SailingIcon from "@mui/icons-material/Sailing";
import TerrainIcon from "@mui/icons-material/Terrain";
import GrassIcon from "@mui/icons-material/Grass";

import type { Coordinates, UserProfile } from "@/shared/types/weather";

/** Every dashboard takes exactly these two. `locationName` is display-only,
 * but every dashboard header expects it, so it is not optional. */
export interface DashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

export interface ProfileDefinition {
  id: UserProfile;
  /** Shown in the selector's closed state — keep it short, the header is tight. */
  label: string;
  /** The one-line "what this lens is for", shown under the label in the menu. */
  description: string;
  icon: ReactNode;
  /** Code-split: render inside `<Suspense>`. */
  Dashboard: ComponentType<DashboardProps>;
  /** Fetches the dashboard's chunk. Calling it again is free once loaded. */
  load: () => Promise<{ default: ComponentType<DashboardProps> }>;
}

type DashboardLoader = ProfileDefinition["load"];

/**
 * Each dashboard is its own chunk, so first load downloads only the lens in
 * use rather than all four — they were most of an 800 kB main bundle.
 */
const loaders: Record<UserProfile, DashboardLoader> = {
  general: () =>
    import("@/features/forecast/components/GeneralDashboard").then((m) => ({
      default: m.GeneralDashboard,
    })),
  marine: () =>
    import("@/features/marine/components/MarineDashboard").then((m) => ({
      default: m.MarineDashboard,
    })),
  mountain: () =>
    import("@/features/mountain/components/MountainDashboard").then((m) => ({
      default: m.MountainDashboard,
    })),
  agriculture: () =>
    import("@/features/agriculture/components/AgriculturalDashboard").then(
      (m) => ({ default: m.AgriculturalDashboard }),
    ),
};

function lens(
  definition: Omit<ProfileDefinition, "Dashboard" | "load">,
): ProfileDefinition {
  const load = loaders[definition.id];
  return { ...definition, load, Dashboard: lazy(load) };
}

export const PROFILES: Record<UserProfile, ProfileDefinition> = {
  general: lens({
    id: "general",
    label: "General",
    description: "What to wear today",
    icon: <PeopleIcon fontSize="small" />,
  }),
  marine: lens({
    id: "marine",
    label: "Marine & fishing",
    description: "Sea state, waves, whether to go out",
    icon: <SailingIcon fontSize="small" />,
  }),
  mountain: lens({
    id: "mountain",
    label: "Mountaineering",
    description: "Ascent prep, avalanche, altitude wind",
    icon: <TerrainIcon fontSize="small" />,
  }),
  agriculture: lens({
    id: "agriculture",
    label: "Growing",
    description: "Soil, frost, irrigation",
    icon: <GrassIcon fontSize="small" />,
  }),
};

/**
 * Fetch every dashboard's chunk. Called once the page is idle, so a lens never
 * opened online is still in the service worker's asset cache when the device
 * goes offline — before code-splitting all four came in the main bundle, and
 * this keeps that guarantee.
 */
export function preloadDashboards() {
  return Promise.all(Object.values(loaders).map((load) => load()));
}

/** Menu order. Insertion order of the record above, not re-sorted — `general`
 * stays first because it is the default. */
export const PROFILE_IDS = Object.keys(PROFILES) as UserProfile[];

export function isProfileId(value: unknown): value is UserProfile {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PROFILES, value)
  );
}

/**
 * Reads `?profile=marine` from a location search string.
 *
 * `public/manifest.json` declares one PWA shortcut per persona pointing at
 * `/?profile=<id>`, so this is a real entry point, not a debug affordance — and
 * it is a URL, so the value is whatever anyone typed. An unknown value returns
 * null and the app keeps the profile it already had; it never throws.
 */
export function profileFromSearch(search: string): UserProfile | null {
  let value: string | null;
  try {
    value = new URLSearchParams(search).get("profile");
  } catch {
    return null;
  }
  return isProfileId(value) ? value : null;
}
