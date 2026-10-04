# Weather Pro — agent brief

A multi-profile weather application: the same location and forecast data is re-interpreted for four
distinct audiences — General Public, Mariners, Mountaineers, Agronomists — each with its own
dashboard, its own API surface, and its own risk analysis. Installable as a PWA with offline
caching.

## Stack

React 19 + TypeScript 5.8, Vite 7, Redux Toolkit 2 (RTK Query), Recharts, react-leaflet. Package
manager: npm. No backend — all data comes from public Open-Meteo endpoints.

**One design system: MUI v9** (`@mui/material` + Emotion). Tailwind, shadcn/ui, Radix, CVA,
`tailwind-merge` and the `cn()` helper were all removed — there is no second styling engine and no
`className`-based utility layer. Style with `sx` and the theme; put anything shared in
`@/shared/theme`. See *MUI setup* below.

## Layout

Feature-based, following [bulletproof-react](https://github.com/alan2207/bulletproof-react).
Dependencies flow **one way: `shared → features → app`**, and features never import each other.

| Path | Holds |
|---|---|
| `src/app/` | composition root — `App.tsx`, the profile registry, `ProfileSelector`; see `src/app/AGENTS.md` |
| `src/features/` | one folder per persona and capability; see `src/features/AGENTS.md` |
| `src/shared/` | theme, UI, API transport, types — the foundation; see `src/shared/AGENTS.md` |
| `src/store/` | `configureStore` + typed hooks; composes feature reducers; see `src/store/AGENTS.md` |
| `public/` | hand-written `sw.js`, PWA `manifest.json`, icons |

Imports use the **`@/` alias** for `src/` (`tsconfig.app.json` paths + `vite.config.ts` resolve —
both must agree). Use it for anything crossing a directory: the ESLint boundary rules match on the
alias, so a relative `../../features/marine` slips past them.

## MUI v9 — system props are gone

**v9 removed system props.** `alignItems`, `justifyContent`, `color`, `fontWeight`, `mb` and the
rest are no longer accepted as direct props on `Stack`, `Typography`, `Box` — they go in `sx`:

```tsx
<Stack direction="row" alignItems="center">          // v7, fails to compile on v9
<Stack direction="row" sx={{ alignItems: "center" }}> // v9
```

The failure is a wall of `TS2769: No overload matches this call` naming a missing `component` prop,
which points nowhere near the real cause. A component's *own* props (`direction`, `spacing`,
`variant`, `severity`, a `Chip`'s `color`) are unaffected — only the system props moved.
`@mui/codemod v9.0.0/system-props` does this automatically on a large file.

## MUI setup

`@/shared/theme/AppTheme` wraps the app in `ThemeProvider` + `<CssBaseline />`. There is no
`StyledEngineProvider injectFirst` and no `modularCssLayers` — both existed only to arbitrate
against Tailwind, and there is nothing left to arbitrate with.

`cssVariables: true` is on, so the palette is readable as `var(--mui-palette-primary-main)` and the
light/dark `colorSchemes` switch without a re-render. Note `theme.colorSchemes` is not on the
`Theme` type even though it works at runtime — read `theme.vars` instead.

**`optimizeDeps.include` in `vite.config.ts` is load-bearing.** Deep imports (`@mui/material/Stack`
and ~50 siblings) make Vite pre-bundle a shared chunk that pulls Emotion in both with and without a
`?v=` hash, which loads React twice and produces "Invalid hook call" on a blank page. Listing
`@mui/material`, `@mui/material/styles`, `@mui/icons-material`, `@emotion/react` and
`@emotion/styled` is what prevents it. Do not remove those entries to "clean up".

## Running it

```bash
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # eslint . — clean; the two shadcn baseline errors went with the files
npm test          # vitest, watch mode
npm run test:run  # vitest run, single pass — use this in scripts and CI
npm run typecheck # tsc -b --force
```

No credentials needed. Open-Meteo and Nominatim are keyless. `.env` is untracked and unused — do
not invent `VITE_*` variables without adding them there first.

Tests run on **Vitest + jsdom + Testing Library**. What is covered: every feature's pure `lib/`
(advice, scoring, parsing, geolocation), the shared libs and transport (`baseQuery`, units, geo,
map tiles), the shared UI atoms and `SectionErrorBoundary`, the profile registry, and store
persistence. What is not: the four dashboards and `App` as rendered wholes. A green suite is
strong evidence for the logic and weak evidence the page works — load it before claiming a UI
change is done.

## Invariants

- PostCSS config must stay `postcss.config.cjs`. `package.json` sets `"type": "module"`, so a
  `.js` config using `module.exports` fails to load.
- All Redux access goes through `useAppSelector` / `useAppDispatch` from `@/store/hooks`,
  never the untyped react-redux hooks.
- Weather and profile types are imported from `@/shared/types/weather`. Do not redeclare shapes
  inline in a component.
- **WGS 84 decimal degrees (EPSG:4326) is the only coordinate system, everywhere**, ordered
  `latitude, longitude`. Every source already speaks it, so nothing in this app converts a
  coordinate — a function that does is a bug. `@/shared/lib/geo` owns the constant, the range
  checks, `normalizeCoordinates` and `formatCoordinates`; boundaries that admit a coordinate from
  outside normalize there. See [ADR 0001](docs/adr/0001-wgs84-is-the-only-coordinate-system.md).
- Dashboard components take both `coordinates` **and** `locationName` as props; `locationName` is
  display-only but every dashboard header expects it.

## Gotchas

- `public/sw.js` precaches only paths that survive a rebuild (`/`, `offline.html`, the icons);
  Vite's hashed `/assets/*` files are cached at runtime, cache-first. So a code-split chunk works
  offline only once something has fetched it — which is why `App` calls `preloadDashboards()` at
  idle. Add a lazy chunk without a preload and that screen breaks offline.
- `.github/copilot-instructions.md` is a one-line shim to this file; keep it that way, a second
  copy of the brief drifts.
- Marine, historical and forecast data come from **three different Open-Meteo hosts**
  (`api.`, `marine-api.`, `archive-api.`) — a copied `baseUrl` is the usual cause of a 404.
- The "AI analysis" is deterministic rule-based scoring in each feature's `lib/advice.ts`. There is
  no model call; confidence scores are hand-assigned constants, and the UI says so.
- **Open-Meteo's `soil_moisture_*` fields are m³/m³, not percentages.** Convert with
  `soilMoisturePercent` before comparing against any threshold — raw values never exceed 1, so every
  reading on Earth otherwise scores "Very dry — irrigate immediately".

## Where to look

Read the root, match your work to a row, then open **one** leaf:

| Working in | Read first |
|---|---|
| `src/features/` | [`src/features/AGENTS.md`](src/features/AGENTS.md) |
| `src/shared/` | [`src/shared/AGENTS.md`](src/shared/AGENTS.md) |
| `src/app/` | [`src/app/AGENTS.md`](src/app/AGENTS.md) |
| `src/store/` | [`src/store/AGENTS.md`](src/store/AGENTS.md) |

## Conventions

- Components are named exports; slices are default exports.
- Styling is `sx` and the theme. There is no `className` utility layer and no `cn()` helper — if a
  style is worth sharing, it belongs in `@/shared/theme/theme.ts` (`components` overrides or a
  palette entry), not copied between `sx` props.
- **`QueryState`'s `children` is a render prop, not a node** — `{() => …}`, never `{…}`. JSX
  children are evaluated by the *caller*, so a node would run `data!.hourly.time` while `data` is
  still undefined, which is the exact crash `QueryState` exists to prevent.

## Context files

- `CONTEXT.md` — the domain glossary. Terms mean what it says they mean.
- `docs/adr/` — decisions and why, created lazily.
- `.cortex/index/`, `.cortex/findings/` — generated by Cortex; safe to delete and regenerate.
