# `src/shared/` — the foundation

Code that any feature may use and that knows nothing about any of them. This is the bottom of the
dependency graph: **shared never imports from `@/features` or `@/app`**, enforced by ESLint.

If something here needs to know about a feature, it does not belong here.

| Path | Holds |
|---|---|
| `api/` | RTK Query APIs — one per Open-Meteo host, plus the analysis helpers still living with them |
| `theme/` | the MUI theme (`theme.ts`, `AppTheme.tsx`) and the legacy per-profile Tailwind classes |
| `ui/` | presentational components used by more than one feature |
| `lib/` | cross-cutting helpers |
| `types/` | `weather.ts` — every API response and domain type in the app |

## API layer

Four `createApi` instances across three Open-Meteo hosts:

| File | Host | Serves |
|---|---|---|
| `weatherApi.ts` | `api.open-meteo.com` | general + mountain forecasts, historical, long-range |
| `marineApi.ts` | `marine-api.open-meteo.com` | waves, swell, sea state |
| `agriculturalApi.ts` | `api.open-meteo.com` | soil, evapotranspiration, frost |
| `historicalApi.ts` | `archive-api.open-meteo.com` | archive series |

**Base URLs differ per host.** Copying one into another endpoint gives a 404, not a type error.

These live in `shared` because `weatherApi.ts` serves three different personas — a feature could not
own it without another feature importing across the boundary. The intended fix is one base API per
host with each feature calling `injectEndpoints`, which is what lets the endpoints move into the
features that use them. That refactor has not happened yet.

Every API registered in `@/store/store.ts` needs **both** its reducer and its middleware. Omitting
the middleware raises no error — the query just never fires.

## `ui/`

`badge`, `button`, `card`, `select` are generated shadcn primitives and are **legacy** — being
replaced by MUI. `WeatherCard`, `WeatherChart`, `WeatherMap` and `AIAnalysisComponent` are the
app's own.

- `WeatherCard` is the only component that converts units; everything else renders raw metric.
- `WeatherMap` drives Leaflet imperatively through refs, not react-leaflet's components, and
  patches marker icons to CDN URLs — so markers need the network even when the app is offline.
- `AIAnalysisComponent` discriminates the four analysis shapes with `in` checks rather than a
  tagged union, so adding a profile analysis needs a branch here that TypeScript will not force.

## Naming

The "AI analysis" is rule-based scoring — fixed thresholds and hard-coded confidence constants. No
model is called. See `CONTEXT.md`.
