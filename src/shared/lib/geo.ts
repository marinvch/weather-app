/**
 * WGS 84 is the app's one coordinate reference system. Everything.
 *
 * Every latitude/longitude pair that crosses a boundary in this app — into the
 * store, into an Open-Meteo query, into Nominatim, into Leaflet, out of the
 * browser's Geolocation API — is WGS 84 decimal degrees. There is no second
 * datum and no projected coordinate anywhere in application code, so no
 * conversion is ever needed and any function that appears to do one is a bug.
 *
 * This costs nothing to hold because every source already speaks it:
 *
 * | Source | What it gives us |
 * |---|---|
 * | `navigator.geolocation` | WGS 84 by specification |
 * | Open-Meteo (all three hosts) | WGS 84 `latitude` / `longitude` params |
 * | Nominatim | WGS 84 `lat` / `lon` params |
 * | Leaflet `LatLng` | WGS 84 |
 *
 * **Leaflet is the one place a projection exists, and it never reaches us.**
 * Its tile layer renders in Web Mercator (EPSG:3857) because that is what slippy
 * map tiles are cut in, but its whole public API — `setView`, `LatLng`, marker
 * positions, click events — is WGS 84. Do not "convert to 3857" for Leaflet; you
 * would be projecting something twice.
 *
 * **Axis order is `latitude, longitude`**, matching every source above and the
 * `Coordinates` type. GeoJSON is the exception in the wider world — it orders
 * pairs `[longitude, latitude]` — so anything that ever reads or writes GeoJSON
 * must swap explicitly at that boundary and nowhere else.
 */

import type { Coordinates } from "@/shared/types/weather";

export const WGS84 = {
  /** The EPSG code, for anywhere that has to name the CRS to a service. */
  epsg: "EPSG:4326",
  name: "WGS 84",
  /** Degrees. Latitude is clamped to this; it does not wrap. */
  minLatitude: -90,
  maxLatitude: 90,
  /** Degrees. Longitude wraps — 181° is 1° west of the antimeridian. */
  minLongitude: -180,
  maxLongitude: 180,
  /**
   * Decimal places used whenever coordinates are shown to a person or used as
   * a cache key. Four places is ~11 m at the equator — finer than any forecast
   * grid we consume, and coarse enough that GPS jitter does not invalidate a
   * cached query on every reading.
   */
  precision: 4,
} as const;

export function isValidLatitude(latitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    latitude >= WGS84.minLatitude &&
    latitude <= WGS84.maxLatitude
  );
}

export function isValidLongitude(longitude: number): boolean {
  return (
    Number.isFinite(longitude) &&
    longitude >= WGS84.minLongitude &&
    longitude <= WGS84.maxLongitude
  );
}

/** True when both components are finite and in range for WGS 84. */
export function isValidCoordinates(
  coordinates: Coordinates | null | undefined,
): coordinates is Coordinates {
  return (
    coordinates != null &&
    isValidLatitude(coordinates.latitude) &&
    isValidLongitude(coordinates.longitude)
  );
}

/**
 * Bring a pair into canonical WGS 84 range: latitude clamps at the poles,
 * longitude wraps around the antimeridian. A map drag past 180° hands back
 * longitudes like 187° or -412°, and Open-Meteo rejects those — this is why
 * anything coming out of Leaflet goes through here first.
 *
 * A longitude already in range is returned bit-for-bit unchanged. The wrapping
 * arithmetic is only applied when it is needed, because `((x + 180) % 360 …)`
 * costs a few ulps — it turns 27.4039 into 27.40390000000002, which is enough
 * to break a cache key and an equality check.
 */
export function normalizeCoordinates(coordinates: Coordinates): Coordinates {
  const latitude = Math.min(
    WGS84.maxLatitude,
    Math.max(WGS84.minLatitude, coordinates.latitude),
  );
  const longitude = isValidLongitude(coordinates.longitude)
    ? coordinates.longitude
    : ((((coordinates.longitude + 180) % 360) + 360) % 360) - 180;

  return { latitude, longitude };
}

/**
 * The one way coordinates are shown to a person: `"42.4619, 27.4039"`.
 * Used as the location name whenever reverse geocoding has nothing better.
 */
export function formatCoordinates(
  coordinates: Coordinates,
  precision: number = WGS84.precision,
): string {
  return `${coordinates.latitude.toFixed(precision)}, ${coordinates.longitude.toFixed(precision)}`;
}

/**
 * A stable key for a point, for caches and effect guards.
 *
 * Rounded on purpose: raw geolocation readings drift in the far decimals even
 * when the device has not moved, so an unrounded key produces a fresh miss on
 * every reading. That is exactly what made reverse geocoding loop until
 * Nominatim rate-limited us.
 */
export function coordinatesKey(coordinates: Coordinates): string {
  const { latitude, longitude } = normalizeCoordinates(coordinates);
  return `${latitude.toFixed(WGS84.precision)},${longitude.toFixed(WGS84.precision)}`;
}

/** Whether two points are the same to display precision. */
export function sameCoordinates(a: Coordinates, b: Coordinates): boolean {
  return coordinatesKey(a) === coordinatesKey(b);
}
