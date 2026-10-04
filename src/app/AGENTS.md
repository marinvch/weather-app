# `src/app/` — the composition root

Scoped brief. Read the root `/AGENTS.md` first for stack and conventions; this adds depth for
`src/app/`.

The top of the dependency graph and the only place allowed to import from more than one feature.
It holds the profile registry (`profiles.tsx`), the page frame and location flow (`App.tsx`), and
the header controls (`components/`). It decides which features exist and how they fit together,
and nothing else: logic that belongs to one persona goes in that feature.

## Invariants

- **`profiles.tsx` is the one registry of what a Profile is.** `PROFILES` and `loaders` are both
  `Record<UserProfile, …>`, so a missing entry is a compile error. Adding a persona is: extend the
  `UserProfile` union in `@/shared/types/weather`, add one loader and one `PROFILES` entry, then
  list it in the `PROFILES` validator in `@/store/persistence` and add its shortcut to
  `public/manifest.json`. No feature may import this file.
- **Dashboards are lazy, one chunk each.** `Dashboard` must render inside `<Suspense>`, inside a
  `SectionErrorBoundary` — a chunk that fails to load offline throws there. `preloadDashboards()`
  runs at idle so every lens is in the service worker's cache; a loader added to `loaders` is
  preloaded automatically, a lazy import added anywhere else is not.
- **Every section of the page has its own `SectionErrorBoundary`** with
  `resetKeys = [coordinatesKey(currentCoords), profile]`, so a new place or lens retries a section
  that crashed. A section mounted without one takes the whole page down with it.
- **The geolocation fallback is Medenrudnik, Burgas, Bulgaria** — `DEFAULT_COORDS` in `App.tsx`,
  not London, which older notes claim. It is at module scope on purpose: as a literal inside the
  component it was a new object every render and made the location effect loop.
- **Reverse geocoding runs once per coordinate pair.** The location effect depends on `location`
  from the store and guards with the `geocodedFor` ref keyed by `coordinatesKey`. Do not add
  `currentCoords` to its dependencies or drop the guard: that loop hit the browser's geolocation
  and Nominatim on every render, which Nominatim's usage policy forbids.
- **A location restored from the last visit counts as having one**, so a returning user is not
  asked for the geolocation permission again on load.
- **`?profile=<id>` is a real entry point**, read once on boot after the persisted profile, so a
  PWA shortcut wins over the last visit. `profileFromSearch` returns null for anything unknown and
  never throws.

## Gotchas

- `selectPlace` keeps the name the user picked and does not re-resolve it from the coordinate.
- `AlertsPanel` sits above the map and the dashboard deliberately, and it only derives alerts when
  it is passed `coordinates`.
- `AirQualityPanel` is mounted here for all four lenses rather than inside one dashboard.
- `UpdatePrompt` and `InstallPrompt` render nothing until the browser has something to offer, so
  they are mounted unconditionally.

## Tests

```bash
npx vitest run src/app
```

Only `profiles.test.tsx` exists: it resolves every dashboard loader and checks `profileFromSearch`.
`App.tsx` and everything in `components/` have no tests — load the page after changing them.
