# `src/shared/` — the foundation

Code that any feature may use and that knows nothing about any of them. This is the bottom of the
dependency graph: **shared never imports from `@/features` or `@/app`**, enforced by ESLint.

If something here needs to know about a feature, it does not belong here.

| Path | Holds |
|---|---|
| `api/` | one RTK Query base API per Open-Meteo host — transport only |
| `theme/` | the MUI theme (`theme.ts`) and the provider (`AppTheme.tsx`) |
| `ui/` | presentational components used by more than one feature |
| `types/` | `weather.ts` — every API response and domain type in the app |

## API layer

Three `createApi` instances, one per host. Features attach their own endpoints with
`injectEndpoints` (`src/features/*/api/*.ts`) — so the transport is shared and the queries are
owned by whoever needs them.

| File | Host | Serves |
|---|---|---|
| `openMeteoApi.ts` | `api.open-meteo.com` | the shared `getBasicForecast`, plus mountain and agriculture injections |
| `marineBaseApi.ts` | `marine-api.open-meteo.com` | waves, swell, sea state |
| `archiveApi.ts` | `archive-api.open-meteo.com` | historical series |

**Base URLs differ per host.** Copying one into another endpoint gives a 404, not a type error.

Nothing here derives advice. Rules live in the feature that owns the persona
(`src/features/*/lib/advice.ts`), because two personas score the same reading differently.

Every API registered in `@/store/store.ts` needs **both** its reducer and its middleware. Omitting
the middleware raises no error — the query just never fires.

## `ui/`

All MUI. There are no shadcn primitives left: `badge`, `button`, `card`, `select`, `cn()` and
`tailwind-merge` were deleted with the Tailwind removal. Use MUI components directly.

- **`QueryState`** renders the four states every dashboard has — loading, failed, succeeded but
  incomplete, ready. Its `children` is a **render prop**: `{() => …}`, never `{…}`. JSX children
  are evaluated by the caller, so a plain node runs `data!.hourly.time` while `data` is still
  undefined — the exact crash this component exists to prevent.
- **`AdviceCard`** renders any of the four analysis shapes, discriminating them with `in` checks
  rather than a tagged union — adding a persona analysis needs a branch here that TypeScript will
  not force.
- **`WeatherCard`** is the only component that converts units; everything else renders raw metric.
- **`WeatherMap`** drives Leaflet imperatively through refs, not react-leaflet's components, and
  patches marker icons to CDN URLs — so markers need the network even when the app is offline.

## Naming

The "AI analysis" is rule-based scoring — fixed thresholds and hard-coded confidence constants. No
model is called. See `CONTEXT.md`.
