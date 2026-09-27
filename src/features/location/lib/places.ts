import type { GeocodingResult } from "@/shared/types/weather";

/**
 * Turning a geocoding hit into something a person recognises.
 *
 * Pure and separate from the component because the disambiguation is the whole
 * point of the search box: Open-Meteo returns eleven places called Springfield,
 * and a list of eleven identical rows is worse than no search at all.
 */

/**
 * The readable composite handed to `onSelect` and stored as `locationName`.
 *
 * A **display string**, never a location. `locationName` and `Coordinates`
 * travel together and are never the same field — nothing downstream geocodes
 * this back, so it is free to be prose.
 *
 * `admin1` is included only when it is not already the name. "Berlin, Berlin,
 * Germany" is what the naive join produces for city-states, and it reads as a
 * bug.
 */
export function formatPlaceName(place: GeocodingResult): string {
  const parts = [place.name];

  if (place.admin1 && place.admin1 !== place.name) {
    parts.push(place.admin1);
  }
  if (place.country && place.country !== place.name) {
    parts.push(place.country);
  }

  return parts.join(", ");
}

/**
 * The dimmer second line under a result, carrying everything that is *not* the
 * name — so the eye reads the bold name first and the disambiguator second.
 *
 * Empty when the result has neither a region nor a country, which is what an
 * ocean feature or a research station comes back as.
 */
export function placeSecondaryText(place: GeocodingResult): string {
  const parts = [place.admin1, place.admin2, place.country].filter(
    (part): part is string => Boolean(part) && part !== place.name,
  );

  // `admin2` is dropped when `admin1` is already present: two levels of
  // administrative division is more than the line can carry, and the first is
  // the one that disambiguates.
  const trimmed = place.admin1 ? parts.filter((p) => p !== place.admin2) : parts;

  return [...new Set(trimmed)].join(", ");
}

/**
 * A stable React key.
 *
 * Open-Meteo's `id` is unique per place, but the same name can appear twice
 * with different ids and — rarely — the same id can repeat across a paged
 * response. Folding the coordinate in makes a collision impossible without
 * inventing an index-based key, which reorders wrongly as results stream in.
 */
export function placeKey(place: GeocodingResult): string {
  return `${place.id}-${place.latitude}-${place.longitude}`;
}
