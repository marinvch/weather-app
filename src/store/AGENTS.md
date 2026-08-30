# `src/store/` — state and data access

RTK Query is the only data layer. There is no fetch wrapper, no service class, no backend of our
own — every endpoint hits a public Open-Meteo host directly from the browser.

## Shape

| Path | Holds |
|---|---|
| `store.ts` | `configureStore` — registers 4 API reducers + 4 middlewares + 3 feature slices |
| `hooks.ts` | `useAppSelector` / `useAppDispatch`, the only Redux hooks callers may use |
| `api/weatherApi.ts` | forecast for the general + mountain profiles, `api.open-meteo.com/v1/` |
| `api/marineApi.ts` | waves, swell, sea state, `marine-api.open-meteo.com/v1/` |
| `api/historicalApi.ts` | archive series, `archive-api.open-meteo.com/v1/` |
| `api/agriculturalApi.ts` | soil temperature/moisture, `api.open-meteo.com/v1/` |
| `slices/` | `userProfile` (profile, location, units), `preferences`, `alerts` |

## Adding an API

Both halves or nothing. In `store.ts`:

```ts
[newApi.reducerPath]: newApi.reducer,   // reducer map
.concat(newApi.middleware)              // middleware chain
```

Registering only the reducer produces no error — the hook just never fetches and never errors.
This is the single most common failure in this directory.

## Rules

- **Base URLs differ per host.** Copying `weatherApi`'s `baseUrl` into a marine or archive endpoint
  yields a 404, not a type error. Check the host, not just the path.
- **Types come from `src/types/weather.ts`.** Response interfaces are shared with components; do
  not declare a local response shape.
- **Analysis helpers live in the API file** that produces the data they interpret
  (`generateGeneralAnalysis`, `generateMountainAnalysis`, …). They are pure functions over a
  response — keep them pure and keep them out of components.
- The `serializableCheck` ignore-list in `store.ts` names `persist/*` actions for a redux-persist
  integration that **is not installed**. Harmless, but do not treat it as evidence persistence
  exists.
- Slice state is not persisted anywhere. A reload resets profile and preferences.

## Gotchas

- `generateGeneralAnalysis` and `generateMountainAnalysis` are exported from `weatherApi.ts` so
  they can be tested directly — see `weatherApi.test.ts`. Keep them exported and keep them pure.
- Cache lifetimes are RTK Query defaults unless a specific endpoint overrides `keepUnusedDataFor`.
  The 5-minute figure quoted in older docs is the **service worker's** cache
  (`public/sw.js`), a separate layer.
