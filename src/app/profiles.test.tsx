import { describe, it, expect } from "vitest";
import {
  PROFILES,
  PROFILE_IDS,
  preloadDashboards,
  profileFromSearch,
} from "./profiles";

describe("profile registry", () => {
  it.each(PROFILE_IDS)("%s loads a dashboard component", async (id) => {
    // Dashboards are code-split. A loader pointing at a renamed export would
    // only fail when someone opened that lens — so resolve every one here.
    const { default: Dashboard } = await PROFILES[id].load();
    expect(typeof Dashboard).toBe("function");
  });

  it("preloads every dashboard so all four are cached for offline use", async () => {
    await expect(preloadDashboards()).resolves.toHaveLength(PROFILE_IDS.length);
  });
});

describe("profileFromSearch", () => {
  it("reads a known profile from the query string", () => {
    expect(profileFromSearch("?profile=marine")).toBe("marine");
  });

  it("ignores an unknown or missing profile", () => {
    expect(profileFromSearch("?profile=admin")).toBeNull();
    expect(profileFromSearch("")).toBeNull();
    // Not an own property of the registry, even though `in` would say yes.
    expect(profileFromSearch("?profile=toString")).toBeNull();
  });
});
