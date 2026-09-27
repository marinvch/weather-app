import type { DailyWeatherWithAstronomy } from "@/shared/types/weather";

/**
 * Daylight arithmetic — pure, no React, no store.
 *
 * Two things about Open-Meteo's astronomy block drive everything here:
 *
 * 1. **`daylight_duration` and `sunshine_duration` are seconds**, not hours.
 *    A raw 50400 rendered as "50400 hours of daylight" is the obvious failure;
 *    the quiet one is dividing by 60 once and shipping "840 hours".
 * 2. **`sunrise` and `sunset` are local wall-clock times with no offset** —
 *    `"2026-09-05T06:42"`. `new Date()` on that string parses it in the
 *    *browser's* timezone, so looking at Tokyo from Sofia shifts sunrise by six
 *    hours while still producing a perfectly valid-looking time. Nothing here
 *    puts those strings through `Date` for display; see `formatLocalTime`.
 */

/** `HH:MM` out of an Open-Meteo local timestamp, or null if it is not one. */
function readClock(iso: string): { hours: number; minutes: number } | null {
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return { hours, minutes };
}

/**
 * A local timestamp as a locale-formatted time — 12- or 24-hour to taste,
 * without ever shifting it.
 *
 * The hours and minutes are read out of the string and re-formatted through a
 * throwaway UTC instant, so `Intl` decides the *presentation* (am/pm, digit
 * shape) while the *value* stays exactly the wall-clock time the API sent for
 * that coordinate. Constructing `new Date(iso)` instead would apply the
 * viewer's own offset to a time that is already local to somewhere else.
 */
export function formatLocalTime(iso: string, locales?: string | string[]): string {
  const clock = readClock(iso);
  if (!clock) return "--:--";

  const instant = new Date(Date.UTC(2000, 0, 1, clock.hours, clock.minutes));
  return instant.toLocaleTimeString(locales ?? [], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Minutes since local midnight, for positioning a point along the day. */
export function minutesIntoDay(iso: string): number | null {
  const clock = readClock(iso);
  return clock ? clock.hours * 60 + clock.minutes : null;
}

/**
 * A duration in **seconds** as hours and minutes — "14 h 12 min".
 *
 * Seconds is the unit Open-Meteo sends and the unit this takes. Passing a
 * figure that has already been divided produces a plausible, wrong answer
 * rather than an error, which is why the parameter is named for its unit.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--";

  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

export interface DaylightDay {
  /** The `daily.time` entry this describes — a local `YYYY-MM-DD`. */
  date: string;
  /** Local wall-clock time at the coordinate, already formatted. */
  sunrise: string | null;
  sunset: string | null;
  /** Seconds. Sunrise to sunset. */
  daylightSeconds: number | null;
  /** Seconds. The part of daylight above the "sunny" irradiance threshold. */
  sunshineSeconds: number | null;
  /**
   * Sunshine as a fraction of daylight, 0 to 1 — the figure a "how grey is it"
   * bar needs. Null when either duration is missing, because a bar drawn from
   * a guess is worse than no bar.
   */
  sunshineFraction: number | null;
  uvIndexMax: number | null;
}

function seriesValue(
  series: number[] | undefined,
  index: number,
): number | null {
  const value = series?.[index];
  return value === undefined || value === null || !Number.isFinite(value)
    ? null
    : value;
}

/**
 * Read one day out of the daily block.
 *
 * Every astronomy field is optional — Open-Meteo returns only the `daily=`
 * variables that were asked for — so this reports what is present rather than
 * failing when something is not. `null` fields mean "not supplied", and a
 * caller renders nothing for them instead of a zero.
 */
export function daylightForDay(
  daily: DailyWeatherWithAstronomy | undefined,
  index = 0,
): DaylightDay | null {
  const date = daily?.time?.[index];
  if (!daily || date === undefined) return null;

  const sunriseIso = daily.sunrise?.[index];
  const sunsetIso = daily.sunset?.[index];

  const daylightSeconds = seriesValue(daily.daylight_duration, index);
  const sunshineSeconds = seriesValue(daily.sunshine_duration, index);

  // Sunshine is a subset of daylight by definition, so the ratio cannot exceed
  // 1. Clamping rather than trusting it: the two series are modelled
  // separately and rounding at the edges of a polar day can push it a hair
  // over, which would overflow a progress bar.
  const sunshineFraction =
    daylightSeconds !== null && sunshineSeconds !== null && daylightSeconds > 0
      ? Math.min(1, Math.max(0, sunshineSeconds / daylightSeconds))
      : null;

  return {
    date,
    sunrise: sunriseIso ? formatLocalTime(sunriseIso) : null,
    sunset: sunsetIso ? formatLocalTime(sunsetIso) : null,
    daylightSeconds,
    sunshineSeconds,
    sunshineFraction,
    uvIndexMax: seriesValue(daily.uv_index_max, index),
  };
}

/**
 * Minutes since midnight **at the coordinate**, from Open-Meteo's
 * `utc_offset_seconds`.
 *
 * The viewer's own clock is the wrong answer for anywhere they are not
 * standing: checking Reykjavik from Sofia would put the "now" marker two hours
 * late on a strip whose sunrise and sunset are Icelandic. Since
 * `utc_offset_seconds` comes back with every `timezone: "auto"` response, the
 * right offset is always to hand.
 */
export function localMinutesNow(
  utcOffsetSeconds: number,
  now: Date = new Date(),
): number {
  const offset = Number.isFinite(utcOffsetSeconds) ? utcOffsetSeconds : 0;
  const localSeconds = Math.floor(now.getTime() / 1000) + offset;
  // Two moduli: the first can be negative for a west-of-Greenwich offset in
  // the first hours of a UTC day, and a negative minute count silently reads
  // as "before sunrise" all afternoon.
  return Math.floor((((localSeconds % 86400) + 86400) % 86400) / 60);
}

/**
 * How far through the daylit part of the day it is now, 0 to 1.
 *
 * `nowMinutes` is minutes since local midnight **at the coordinate**, which the
 * caller has to supply — this function has no way to know it, and using the
 * viewer's clock would put the marker in the wrong place for any location they
 * are not standing in.
 *
 * Clamped, so before sunrise reads 0 and after sunset reads 1 rather than
 * running off either end of the strip.
 */
export function daylightProgress(
  nowMinutes: number,
  sunriseIso: string,
  sunsetIso: string,
): number | null {
  const sunrise = minutesIntoDay(sunriseIso);
  const sunset = minutesIntoDay(sunsetIso);

  if (sunrise === null || sunset === null || sunset <= sunrise) return null;

  return Math.min(1, Math.max(0, (nowMinutes - sunrise) / (sunset - sunrise)));
}
