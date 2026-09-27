# `src/shared/` — the foundation

Code that any feature may use and that knows nothing about any of them. This is the bottom of the
dependency graph: **shared never imports from `@/features` or `@/app`**, enforced by ESLint.

If something here needs to know about a feature, it does not belong here.

| Path | Holds |
|---|---|
| `api/` | one RTK Query base API per Open-Meteo host — transport only |
| `lib/` | `geo.ts` (the WGS 84 contract), `units.ts` (display conversion), `queryError.ts`, `mapTiles.ts` + `arrowField.ts` (the map's sources and its maths) |
| `theme/` | the MUI theme (`theme.ts`), the WMO code table (`conditions.ts`), the provider |
| `ui/` | presentational components used by more than one feature |
| `types/` | `weather.ts` — every API response and domain type in the app |

## `lib/geo.ts`

**WGS 84 decimal degrees (EPSG:4326) is the app's only coordinate system**, ordered
`latitude, longitude`. Every source speaks it already — Geolocation API, all three Open-Meteo
hosts, Nominatim, Leaflet's `LatLng` — so nothing here converts, and a conversion function would
be a bug. Leaflet's Web Mercator tiles are a rendering detail inside Leaflet; it never reaches us.

Use `formatCoordinates` for anything shown to a person and `coordinatesKey` for any cache key or
effect guard — the key rounds to `WGS84.precision` on purpose, because unrounded GPS drift missed
on every reading and drove the reverse-geocode loop into Nominatim's rate limit.

`normalizeCoordinates` runs at each boundary that admits a coordinate from outside. It clamps
latitude and wraps longitude, and returns in-range values untouched — the wrapping arithmetic
costs a few ulps, enough to break the very keys it feeds. See
[ADR 0001](../../docs/adr/0001-wgs84-is-the-only-coordinate-system.md).

## API layer

Six `createApi` instances, one per host. Features attach their own endpoints with
`injectEndpoints` (`src/features/*/api/*.ts`) — so the transport is shared and the queries are
owned by whoever needs them.

| File | Host | Serves |
|---|---|---|
| `openMeteoApi.ts` | `api.open-meteo.com` | the shared `getBasicForecast`, plus mountain and agriculture injections |
| `marineBaseApi.ts` | `marine-api.open-meteo.com` | waves, swell, sea state |
| `archiveApi.ts` | `archive-api.open-meteo.com` | historical series |
| `airQualityApi.ts` | `air-quality-api.open-meteo.com` | pollutants, AQI, UV, pollen |
| `geocodingApi.ts` | `geocoding-api.open-meteo.com` | name to coordinate (forward only) |
| `floodApi.ts` | `flood-api.open-meteo.com` | GloFAS river discharge |

**Base URLs differ per host.** Copying one into another endpoint gives a 404, not a type error.

Every base API is built with `createBaseQuery(baseUrl)` from `baseQuery.ts`, never a bare
`fetchBaseQuery`: it adds a 12 s timeout and up to two retries, only on transient failures (network,
timeout, 5xx, 429). A bare `fetchBaseQuery` has no timeout, so a hung request shows a skeleton
forever. Never pass an option to RTK's `retry` as an explicit `undefined`: it merges
`{ backoff: defaultBackoff, ...yours }`, so `backoff: undefined` erases the default and every retry
throws. Tests that inject a `backoff` cannot see this — `baseQuery.test.ts` keeps one that does not.

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
- **`WeatherMap`** drives Leaflet imperatively through refs, not react-leaflet's components. Its
  markers are inline-SVG `DivIcon`s: the CDN PNG patch is gone, so they draw offline. It is built
  **once** — the callbacks live in refs, because a dashboard's inline `onLocationSelect` in the init
  effect's deps tore the map down and rebuilt it on every parent render. Overlays (`seamarks`,
  `radar`) and arrow fields are additive props; **it fetches nothing except the reverse-geocode
  behind `onLocationSelect` and the RainViewer frame index, and the latter only once the radar is
  switched on**. A feature owning wind or wave data passes a `DirectionFieldSpec` down —
  `shared` must not go and get it.
- **`arrowField.ts`** holds the one thing about direction fields that is easy to get wrong and
  impossible to see: Open-Meteo's `wind_direction_10m` is the direction the wind blows **from**,
  while `wave_direction` is the direction waves travel **towards**. Every arrow is drawn pointing
  downstream, so `convention: "from" | "towards"` is a **required** field on the spec — never
  defaulted. Get it wrong and the field still looks coherent, it just points at the wrong coast.
- **`DashboardShell`** is the header-plus-four-states frame all four dashboards share. Its
  `children` is a plain node, unlike `QueryState`'s render prop, because the shell holds no `data`
  to guard — a call site that needs the payload narrowed puts `QueryState` *inside* it.
- **`SectionErrorBoundary`** catches *render* errors, which `QueryState` and `DashboardShell`
  cannot see — they handle failed *requests*. `App` wraps every page section in one, with
  `resetKeys` of the coordinate and profile, so one broken panel shows a named error with Retry
  instead of blanking the page.
- **`HeroConditions`**, **`MetricTile`** and **`RiskGauge`** are the atoms dashboards are rebuilt
  from. None of them communicates severity by colour alone: `MetricTile` puts the level in its
  accessible name and steps a left rule with it, `RiskGauge` uses a distinct icon outline per level
  and a lit-segment count.

## `lib/units.ts`

Every value held in this app is metric, because that is how Open-Meteo is queried. Conversion is a
*display* step and happens only in these functions — a threshold in a feature's `advice.ts` compares
against the metric number, or the same forecast scores differently depending on a display
preference.

`soilMoisturePercent` is deliberately **not** here. It lives in
`src/features/agriculture/lib/conditions.ts`, and shared may not import from a feature, so this file
cannot re-export it either. Import it from the feature that owns it; a second copy is exactly the
bug that makes two screens disagree.

## `theme/`

`theme.ts` is the design system, not a config file: the palette (including the four-step `risk`
section, reachable as `theme.vars.palette.risk[level]`), the type scale with tabular numerals on the
numeric variants, and the `components` overrides that keep shared style out of `sx`. It augments
`CssThemeVariables` with `enabled: true`, which is what makes `theme.vars` non-optional — without it
every `styleOverrides` callback needs a `!`.

Two values in `theme.ts` are agreements with files outside `src/shared`, and `AppTheme.test.tsx`
fails if either drifts:

- `primary.main` is `#0ea5e9`, matching the PWA theme-color in `index.html` and
  `public/manifest.json`.
- `cssVariables.colorSchemeSelector` is `"data-mui-color-scheme"`. **It must not go back to
  `cssVariables: true`**: with both colour schemes declared, MUI then defaults the selector to
  `'media'`, emits only `@media (prefers-color-scheme: dark)`, and the manual theme toggle becomes a
  silent no-op — `useColorScheme()` still reports the mode you asked for. The blocking inline script
  in `index.html` also stamps that exact attribute before the bundle loads, so renaming it
  reintroduces a first-paint flash of the wrong scheme.

`conditions.ts` is the single source of truth for what a WMO code *reads and looks like*. Its
`severity` is presentation weight, not risk — risk is per-persona and stays in
`features/*/lib/advice.ts`.

## The severity scales are deliberately separate. Do not consolidate them.

This app holds **nine** severity-ish string unions. They are not drafts of one union that somebody
forgot to finish — the split was reviewed and kept. `"medium"` sitting next to `"moderate"` is not a
typo, and a future "cleanup" that merges them is a bug.

`RiskLevel` (`low | moderate | high | severe`) in `types/weather.ts` is the **display** scale: what
`RiskGauge`, `MetricTile`'s `severity: 0|1|2|3` and the theme's `risk` palette are keyed on.

`AIAnalysis.riskLevel` (`low | medium | high`) is what the four `features/*/lib/advice.ts` scorers
emit, and it **stays three-step**. Conversion happens at the display boundary, through
`riskLevelFromAnalysis` — the one sanctioned crossing, tested in `types/weather.test.ts`. A cast
instead yields `"medium"`, which matches no key in the `risk` palette and renders `undefined`
colours rather than failing. `AdviceCard`'s `RISK_COLOR` / `RISK_ICON` stay keyed on the three-step
scale for the same reason.

Three of the feature unions **cannot** be mapped onto `RiskLevel` at all:

| Union | Where | Why it cannot be widened |
|---|---|---|
| `avalancheRisk` | `MountainAnalysis`, `types/weather.ts` | The five-step European Avalanche Danger Scale. **`"considerable"` (EADS level 3) has no equivalent**, and collapsing it into "moderate" or "high" is wrong in both directions. That is a safety statement, not a styling detail. |
| `frostRisk` | `AgriculturalAnalysis`, `types/weather.ts` | `none \| light \| moderate \| severe`. Shares two words, which is what makes it look assignable. `"none"` is a real zero state; aligning the four positionally shifts every reading up a band. |
| the sea-state reading's "no data" member | `features/marine/lib/` | The marine host answers an inland coordinate with a series of nulls, not an error, so the reading carries a no-data member alongside its severities. That member is not a severity: it belongs in `DashboardShell`'s `isEmpty`, and mapping it to `"low"` claims a calm sea where there is none. |

And `fishingConditions` / `soilConditions` run **good to bad**, the opposite direction to
`RISK_LEVELS`. Never map either by array index — `"excellent"` would land on `"low"` only by
accident of ordering, and `"poor"` would come out as low risk.

Note three unrelated types are named `Severity`: agriculture's (three string members), mountain's
(four), and `MetricTile`'s (numeric `0|1|2|3`). Importing two into one file needs an alias, and the
wrong one type-errors in a way that reads like a member-list problem rather than a name clash.

## Naming

The "AI analysis" is rule-based scoring — fixed thresholds and hard-coded confidence constants. No
model is called. See `CONTEXT.md`.
