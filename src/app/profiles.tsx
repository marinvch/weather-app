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

import type { ComponentType, ReactNode } from "react";
import PeopleIcon from "@mui/icons-material/People";
import SailingIcon from "@mui/icons-material/Sailing";
import TerrainIcon from "@mui/icons-material/Terrain";
import GrassIcon from "@mui/icons-material/Grass";

import { GeneralDashboard } from "@/features/forecast/components/GeneralDashboard";
import { MarineDashboard } from "@/features/marine/components/MarineDashboard";
import { MountainDashboard } from "@/features/mountain/components/MountainDashboard";
import { AgriculturalDashboard } from "@/features/agriculture/components/AgriculturalDashboard";
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
  Dashboard: ComponentType<DashboardProps>;
}

export const PROFILES: Record<UserProfile, ProfileDefinition> = {
  general: {
    id: "general",
    label: "General",
    description: "What to wear today",
    icon: <PeopleIcon fontSize="small" />,
    Dashboard: GeneralDashboard,
  },
  marine: {
    id: "marine",
    label: "Marine & fishing",
    description: "Sea state, waves, whether to go out",
    icon: <SailingIcon fontSize="small" />,
    Dashboard: MarineDashboard,
  },
  mountain: {
    id: "mountain",
    label: "Mountaineering",
    description: "Ascent prep, avalanche, altitude wind",
    icon: <TerrainIcon fontSize="small" />,
    Dashboard: MountainDashboard,
  },
  agriculture: {
    id: "agriculture",
    label: "Growing",
    description: "Soil, frost, irrigation",
    icon: <GrassIcon fontSize="small" />,
    Dashboard: AgriculturalDashboard,
  },
};

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
