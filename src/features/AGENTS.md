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

Right now the advice functions still sit in `@/shared/api/*` where they were written. Moving each
into its own feature is the next step; `generateGeneralAnalysis` and `generateMountainAnalysis` are
already exported and tested, so they move first.

## Gotchas

- All four dashboards repeat the same loading / error / incomplete-data / render shape in ~1183
  lines. That duplication is the reason a profile registry has not been built yet — extract the
  shared skeleton first, or the registry just centralises the mess.
- `agriculture` issues two queries and gates loading on both, so a slow soil request blocks the
  whole view.
- Only `location/lib/geolocation.ts` has tests in this layer. Dashboards have none — verify changes
  by running `npm run dev` and loading the page.
