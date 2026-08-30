# Weather Pro — agent brief

A multi-profile weather application: the same location and forecast data is re-interpreted for four
distinct audiences — General Public, Mariners, Mountaineers, Agronomists — each with its own
dashboard, its own API surface, and its own risk analysis. Installable as a PWA with offline
caching.

## Stack

React 19 + TypeScript 5.8, Vite 7, Redux Toolkit 2 (RTK Query), Recharts, react-leaflet. Package
manager: npm. No backend — all data comes from public Open-Meteo endpoints.

**Two design systems, on purpose, mid-migration.** MUI v9 (`@mui/material` + Emotion) is the
direction; TailwindCSS 3 + shadcn/ui (Radix + CVA) is what the UI is built from today. Build new UI
in MUI. See *MUI / Tailwind interop* below before changing anything about how either is configured.

## Layout

| Path | Holds |
|---|---|
| `src/components/Dashboard/` | one dashboard per user profile; the switch lives in `src/App.tsx` |
| `src/components/ui/` | shadcn primitives (badge, button, card, select) — regenerate, don't hand-edit |
| `src/store/api/` | RTK Query APIs, one per profile, plus the AI-analysis helpers |
| `src/store/slices/` | feature state: `userProfile`, `preferences`, `alerts` |
| `src/types/weather.ts` | every weather/profile type in the app — single source |
| `src/utils/` | geolocation, service-worker registration, per-profile theming |
| `src/theme/` | the MUI theme and its provider — `AppTheme` wraps the app in `main.tsx` |
| `public/` | hand-written `sw.js`, PWA `manifest.json`, icons |

## MUI / Tailwind interop

Three settings hold this together. They are a set — changing one alone breaks the UI:

- **`StyledEngineProvider injectFirst`** (`src/theme/AppTheme.tsx`). MUI component styles and
  Tailwind utilities are both single-class selectors, so source order decides. This is what makes a
  `className` on a MUI component actually win.
- **No `<CssBaseline />`, and Tailwind preflight stays on.** MUI's docs say to swap one for the
  other. Do not do that yet: Tailwind's `border` utilities set only `border-width` and rely on
  preflight for `border-style: solid`, and this UI is built on `border`, `border-2` and `border-b-2`
  throughout. Dropping preflight erases every border in the app, silently.
- **No `modularCssLayers`.** That is the correct answer against Tailwind v4, which emits its own
  cascade layers. This repo is on Tailwind **v3**, whose output is unlayered — and unlayered CSS
  beats every layer regardless of specificity, so putting MUI in `@layer mui` would let preflight
  override MUI's own component styles.

When the shadcn layer is finally gone, flip all three in one commit: drop `injectFirst`, add
`<CssBaseline />`, set `corePlugins.preflight: false`.

`cssVariables: true` is on, so Tailwind can reference MUI's palette as
`var(--mui-palette-primary-main)`.

## Running it

```bash
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # eslint . — exits 1 on two known baseline errors, see /type-check
npm test          # vitest, watch mode
npm run test:run  # vitest run, single pass — use this in scripts and CI
npm run typecheck # tsc -b --force
```

No credentials needed. Open-Meteo and Nominatim are keyless. `.env` is untracked and unused — do
not invent `VITE_*` variables without adding them there first.

Tests run on **Vitest + jsdom + Testing Library**. Coverage is partial and deliberate: the pure
logic is covered (emergency-number lookup and reverse-geocode fallbacks, the two analysis scorers,
WeatherCard's unit conversions), the dashboards and the store are not. A green suite means those
three areas still hold — it is not yet evidence the app works.

## Invariants

- Every API registered in `src/store/store.ts` needs **both** its reducer (`api.reducerPath`) and
  its `api.middleware` in the `.concat()` chain. Miss the middleware and RTK Query silently never
  fetches.
- PostCSS config must stay `postcss.config.cjs`. `package.json` sets `"type": "module"`, so a
  `.js` config using `module.exports` fails to load.
- All Redux access goes through `useAppSelector` / `useAppDispatch` from `src/store/hooks.ts`,
  never the untyped react-redux hooks.
- Weather and profile types are imported from `src/types/weather.ts`. Do not redeclare shapes
  inline in a component.
- Dashboard components take both `coordinates` **and** `locationName` as props; `locationName` is
  display-only but every dashboard header expects it.

## Gotchas

- `public/sw.js` pre-caches `/static/js/bundle.js` and `/static/css/main.css`, which are
  Create-React-App paths that do not exist in a Vite build. The API caching works; the app-shell
  precache does not.
- `.github/copilot-instructions.md` is an older hand-written brief. It is mostly accurate but says
  geolocation falls back to **London**; the code falls back to Medenrudnik, Burgas, Bulgaria
  (`src/App.tsx`). Trust the code.
- Marine, historical and forecast data come from **three different Open-Meteo hosts**
  (`api.`, `marine-api.`, `archive-api.`) — a copied `baseUrl` is the usual cause of a 404.
- The "AI analysis" is deterministic rule-based scoring in `src/store/api/weatherApi.ts` and its
  siblings. There is no model call; confidence scores are hand-assigned constants.

## Where to look

Read the root, match your work to a row, then open **one** leaf:

| Working in | Read first |
|---|---|
| `src/components/` | [`src/components/AGENTS.md`](src/components/AGENTS.md) |
| `src/store/` | [`src/store/AGENTS.md`](src/store/AGENTS.md) |

## Conventions

- Components are named exports in `PascalCase/PascalCase.tsx` folders; slices are default exports.
- Tailwind classes are merged with `cn()` from `src/lib/utils.ts` — never concatenate class strings
  by hand, or variant overrides stop winning.
- Profile-conditional styling goes through `src/utils/themes.ts` (`getThemeStyle`,
  `getButtonClasses`), not inline per-profile ternaries in components.

## Context files

- `CONTEXT.md` — the domain glossary. Terms mean what it says they mean.
- `docs/adr/` — decisions and why, created lazily.
- `.cortex/index/`, `.cortex/findings/` — generated by Cortex; safe to delete and regenerate.
