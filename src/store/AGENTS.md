# `src/store/` — the store and what survives a refresh

Scoped brief. Read the root `/AGENTS.md` first for stack and conventions; this adds depth for
`src/store/`.

`store.ts` composes the reducers and middleware, `hooks.ts` exports the typed hooks,
`slices/` holds the two preference slices (`userProfile`, `preferences`), and `persistence.ts`
writes those two slices to localStorage and reads them back. The `alerts` slice lives in
`@/features/alerts/store` and is only composed here.

## Invariants

- **Every API in `store.ts` needs both its reducer (`api.reducerPath`) and its `api.middleware`**
  in the `.concat()` chain. Miss the middleware and nothing errors; RTK Query just never fetches.
- **One API per Open-Meteo host, six in all, not one per persona.** Features add endpoints with
  `injectEndpoints`, so a new feature does not edit `store.ts`. Only a new host does.
- **Only an allow-list is persisted, never the store.** `selectPersistedState` writes `profile`,
  `units`, `location`, `locationName`, `theme`, `favoriteLocations` and `alertSensitivity`. The
  RTK Query caches are never persisted: a rehydrated forecast is stale data shown as current.
  A new field survives a refresh only once it is added to the persisted type, to
  `selectPersistedState` and to `parsePersistedState`.
- **Everything read back is validated field by field and never throws.** A bad field falls back to
  its slice's initial value; bad JSON or a different `STORAGE_VERSION` discards the whole blob.
  There are no migrations — bump `STORAGE_VERSION` on an incompatible shape change.
- **The validators are `Record<Union, true>`**, so a new member of `UserProfile`, the units, the
  theme or the sensitivity union stops compiling here until it is listed.
- **The store does not import `@/app`.** The profile list in `persistence.ts` duplicates
  `@/app/profiles` on purpose. No lint rule enforces this for `src/store/`, so it holds by review.
- **`persistence.ts` does not import `store.ts`.** It takes the structural `PersistableState`
  instead of `RootState`, which avoids an import cycle.
- **The persistence listener matches by action-type prefix** (`userProfile/`, `preferences/`) and
  is prepended to the middleware chain. A new reducer in either slice is persisted automatically;
  a new slice is not.
- **Coordinates entering the store are normalized.** `setLocation` runs `normalizeCoordinates`,
  and a stored coordinate is normalized, then validated, on the way back in.

## Gotchas

- A favourite's `id` is `coordinatesKey(...)`, so `addFavoriteLocation` ignores a point that is
  already saved under another name.
- `preferences` has more fields than are persisted: `refreshInterval`, `cacheExpiry`,
  `autoLocation`, `showDetailed`, `compactView` and `showCharts` reset on every load.
- Both slices export their initial state so persistence can fall back to it. Keep those exports.

## Tests

```bash
npx vitest run src/store
```

`persistence.test.ts` covers parsing, validation and the allow-list. The slices and `store.ts`
have no tests of their own.
