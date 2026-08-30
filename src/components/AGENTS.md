# `src/components/` — UI

17 components, ~3300 lines, no tests. The largest area in the repo and the one where an unnoticed
regression is most likely.

## Shape

| Path | Holds |
|---|---|
| `Dashboard/` | one per profile — General, Marine, Mountain, Agricultural |
| `ui/` | shadcn/ui primitives: badge, button, card, select |
| `WeatherCard/`, `WeatherChart/`, `WeatherMap/` | shared presentation blocks |
| `AIAnalysis/`, `ProfileSelector/`, `EmergencyInfo/`, `OfflineIndicator/` | feature components |

Convention: one folder per component, file named after the folder, named export.

## The dashboard contract

Every dashboard takes the same props and owns its own data fetch:

```tsx
interface DashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

const { data, isLoading, error } = useGetSomethingQuery(coordinates);
```

`coordinates` drives the query; `locationName` is display-only but every header expects it.
`src/App.tsx` picks the dashboard from `userProfile.profile` — a new profile means a new dashboard
component **and** a new branch there.

## Rules

- Never call `useSelector`/`useDispatch` directly — use `useAppSelector`/`useAppDispatch` from
  `src/store/hooks.ts`.
- Compose classes with `cn()` from `src/lib/utils.ts`. Hand-concatenated Tailwind strings break
  variant precedence.
- Profile-dependent colour and button styling comes from `src/utils/themes.ts`
  (`getThemeStyle`, `getButtonClasses`), never an inline per-profile ternary.
- `ui/` files are generated shadcn output. Extend via CVA variants; treat hand edits as something
  the next `shadcn add` will overwrite.
- Every dashboard must render all three RTK Query states — loading, error, and empty data.
  Open-Meteo returns partial payloads (mountain wind at 80m/120m is optional), so a present
  `data` object is not a guarantee the field you want exists.

## Gotchas

- `WeatherMap` drives Leaflet imperatively through refs, not via react-leaflet's components,
  despite react-leaflet being a dependency. Marker icons are patched to CDN URLs because the
  bundled asset paths break — so markers need the network even when the rest of the app is offline.
- `MarineDashboard` renders a suggested-locations empty state when the marine API has no coverage
  for the current point. Those coordinates must sit on open water or the suggestion leads to the
  same empty result it was meant to escape.
- `WeatherCard` is the only component that converts units. Everything else renders raw metric
  regardless of `userProfile.units`.
- Only `WeatherCard` has tests (`WeatherCard.test.tsx`). The dashboards have none — verify changes
  to them by running `npm run dev` and loading the page. A passing build is not evidence a
  dashboard renders.
