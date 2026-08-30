# 0001. Use WGS 84 as the app's only coordinate reference system

**Date:** 2026-08-30
**Status:** accepted

## Context

Coordinates enter this app from four independent places — the browser's Geolocation API, a user
clicking the Leaflet map, hard-coded suggestions in the marine dashboard, and whatever is
rehydrated into the store — and leave it towards four more: three Open-Meteo hosts, Nominatim,
Leaflet, and the screen.

Nothing said what a `Coordinates` pair *was*. The type was two bare numbers with no range, no
datum and no stated axis order, and the handling was scattered: `toFixed(4)` was written out eight
times across three files, the effect guard in `App.tsx` built its cache key by hand from unrounded
floats, and one display site used six decimal places while every other used four.

That vagueness had already produced real bugs. The unrounded cache key meant a stationary device
kept missing, which is what drove the reverse-geocode loop into Nominatim's rate limit. Nothing
anywhere checked that a longitude was in range, so a map dragged past the antimeridian would hand
Open-Meteo a value it rejects.

## Decision

**WGS 84 decimal degrees (EPSG:4326) is the app's only coordinate reference system**, in the axis
order `latitude, longitude`. No coordinate is converted anywhere in application code.

`@/shared/lib/geo` is the single place that knows this: the `WGS84` constant (bounds and display
precision), `isValidCoordinates`, `normalizeCoordinates`, `formatCoordinates`, `coordinatesKey`,
`sameCoordinates`. Every boundary that admits a coordinate from outside normalizes it there —
`getCurrentLocation`, `getLocationInfo`, the map click handler, and the `setLocation` reducer.

This costs nothing, because every source already speaks WGS 84: the Geolocation API by
specification, all three Open-Meteo hosts, Nominatim's `lat`/`lon`, and Leaflet's entire public
`LatLng` API.

## Alternatives rejected

| Option | Why not |
|---|---|
| Leave it implicit — it already worked | It did not. It produced the Nominatim rate-limit loop and left the antimeridian unguarded. "Everything happens to agree" is a property nobody was maintaining, and the eight copies of `toFixed(4)` are what that looks like from the inside. |
| Store Web Mercator (EPSG:3857) to match the map tiles | Leaflet renders tiles in Web Mercator but takes and returns WGS 84 everywhere in its API. Storing 3857 would mean converting on the way in *and* out for the benefit of no consumer, and every weather API would need converting back. |
| A branded `type Wgs84Coordinates = Coordinates & { __brand }` | Would force every construction site through a constructor, which is real enforcement. Rejected for now as more ceremony than a four-boundary app needs — revisit if a second datum ever appears, which is the only thing that would justify it. |
| Support multiple CRSs behind an adapter | Solving a problem the app does not have. No data source offers anything else. |

## Consequences

A `Coordinates` value can be passed to any API, the store, Leaflet or the screen without asking
where it came from — that is the whole benefit, and it is why no conversion function exists.

The cost is that the invariant is documented and normalized, not type-enforced: nothing stops
someone constructing `{ latitude: 200, longitude: 0 }` and passing it straight to a query. The
boundaries catch what comes from outside; they do not catch a mistake made internally. The branded
type above is the escalation if that ever bites.

Ordering is now load-bearing. GeoJSON orders pairs `[longitude, latitude]`, so if GeoJSON is ever
read or written it must swap at that boundary — and a silent swap is invisible at low latitudes,
which is where most testing happens.

`normalizeCoordinates` deliberately returns in-range longitudes untouched rather than running them
through the wrapping arithmetic, because `((x + 180) % 360 …)` costs a few ulps — enough to turn
27.4039 into 27.40390000000002 and break the cache key this decision exists to make reliable.
