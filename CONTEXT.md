# Domain glossary

## Profile

One of the four audiences the app serves — `general`, `marine`, `mountain`, `agricultural`. A
Profile is not a user account: it is a *lens*. It selects which API is queried, which dashboard
renders, which theme applies, and which analysis rules run. Held in
`userProfile.profile` (`src/store/slices/userProfileSlice.ts`), typed as `UserProfile` in
`@/shared/types/weather`.

_Avoid_: "user", "role", "mode" — all three imply permissions or accounts, and there are none.

---

## Analysis

The rule-based interpretation layer that turns raw Open-Meteo numbers into a recommendation, a
`riskLevel` and a list of `profileSpecificTips`. Lives beside the API that feeds it, in
`src/store/api/`. Each profile has its own (`AIAnalysis`, `MountainAnalysis`, …).

_Avoid_: "AI", "prediction", "model". Nothing here calls a model — the confidence scores are
constants and the thresholds are hand-written `if` branches. Calling it AI in code or comments
misleads the next reader about what can be tuned.

---

## Alert

A threshold breach the user has opted into, held in the `alerts` slice — distinct from a **Tip**,
which is advisory text produced by an Analysis and never persisted, and from a **Notification**,
which is the PWA delivery mechanism for an Alert.

_Avoid_: using "warning" for all three.

---

## Location

Always a `Coordinates` pair (`latitude`/`longitude`) in **WGS 84** — the canonical form everything
downstream consumes. The human-readable string is a separate value, `locationName`, resolved from
Nominatim by `@/features/location/lib/geolocation`. They travel together but are never the same
field.

_Avoid_: passing a place name where a Location is expected; no API here geocodes for you.

---

## WGS 84

The app's one coordinate reference system, for everything, always: latitude and longitude in
decimal degrees on the WGS 84 datum (EPSG:4326), in that axis order. Every source already speaks
it — the browser Geolocation API, all three Open-Meteo hosts, Nominatim, and Leaflet's `LatLng` —
so no coordinate is ever converted anywhere in the app. `@/shared/lib/geo` holds the constant, the
range checks, `normalizeCoordinates` and the one display format.

_Avoid_: "EPSG:3857", "Web Mercator", "projected". Leaflet renders its tiles in Web Mercator, but
that projection lives entirely inside Leaflet and never touches a value we hold — a function that
converts coordinates in this codebase is a bug, not a feature. Also avoid GeoJSON's `[lon, lat]`
ordering: if GeoJSON is ever read or written, it swaps at that boundary and nowhere else.

---

## Notes

- Terms only. Decisions go in `docs/adr/`, not here.
- When code and this file disagree, one of them is a bug. Say which.
