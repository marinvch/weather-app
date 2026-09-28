# `src/features/` — the personas and the capabilities

One folder per thing the product does. Four of them are the personas the app exists for; three are
supporting capabilities.

| Feature | Serves |
|---|---|
| `forecast/` | General Public — "how should I dress today" |
| `marine/` | fishermen and boat watchers — sea state, waves, whether to go out |
| `mountain/` | ascent planning — avalanche risk, altitude wind, exposure |
| `agriculture/` | growers, from a balcony to a farm — soil, frost, irrigation |
| `location/` | geolocation, reverse geocoding, country emergency numbers |
| `alerts/` | threshold breaches derived from a forecast |
| `pwa/` | service worker, offline state, install prompt |

## The one rule

**A feature may not import another feature.** ESLint enforces it (`no-restricted-imports` in
`eslint.config.js`) and the error tells you what to do instead: compose them in `src/app`.

The test of whether this is holding: deleting a feature folder should break only `src/app`. If
deleting `marine/` would break `mountain/`, the boundary has already leaked.

Features may import from `@/shared` and from `@/store/hooks`. They may not import from `@/app`.

## Feature shape

Only create the folders a feature actually needs:

```
features/<name>/
  api/          RTK Query endpoints for this feature
  components/   its UI, including its dashboard
  hooks/        hooks only this feature uses
  lib/          pure logic — the advice rules live here
  store/        slice, if it owns client state
```

## Where the advice lives

The product is **advice**, not data — "don't take the boat out", "you'll want layers". That logic
belongs in the feature's `lib/`, as pure functions from a forecast to a recommendation. Keep it out
of components (untestable) and out of the API layer (only reachable through the network).

Every persona's advice now lives in its own `lib/advice.ts`, each with a test beside it; nothing in
`@/shared/api` derives advice.

## Gotchas

- All four dashboards render through `@/shared/ui/DashboardShell` (loading / failed / empty / ready)
  and are registered in `src/app/profiles.tsx`, which code-splits each one. A new dashboard needs
  a registry entry, and its chunk is only offline-safe because `preloadDashboards()` fetches it.
- `agriculture`'s soil profile and river sections each run their own query inside `QueryState`, so
  a slow or failed one degrades only its own section.
- Tests cover every feature's `lib/` (advice, scoring, parsing). Components and dashboards have
  none — verify a UI change by running `npm run dev` and loading the page.
