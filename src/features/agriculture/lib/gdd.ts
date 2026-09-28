/**
 * Growing Degree Days.
 *
 * The standard way to measure how much *growing weather* a crop has had, as
 * opposed to how many days have passed. One GDD is one degree-day of warmth
 * above the temperature below which the crop does not develop — its **base
 * temperature** — so a cold week and a warm week are not the same week, and a
 * crop's stage is far better predicted by accumulated GDD than by the calendar.
 *
 * Everything here is °C. Base temperatures are crop constants published in °C,
 * and converting them to Fahrenheit would change the numbers people compare
 * against their own records — display conversion is `@/shared/lib/units`' job
 * and happens after the accumulation, never inside it.
 */

/** The conventional base for maize and most warm-season crops. */
export const DEFAULT_BASE_TEMPERATURE_C = 10;

export interface GddOptions {
  /**
   * Below this, development is taken as zero. °C. Crop-specific: 10 for maize
   * and sunflower, 0 for winter wheat, 4.5 for many cool-season grasses.
   */
  base?: number;
  /**
   * Optional upper threshold, °C. When given, the **modified** method is used:
   * both daily extremes are clamped into `[base, upper]` before averaging,
   * which is what stops a 40°C afternoon from crediting a crop with growth it
   * did not make — above its upper threshold, development stalls rather than
   * accelerating. Omitted, the simple method is used.
   */
  upper?: number;
}

export interface GddDay {
  /** The `YYYY-MM-DD` the daily payload carried. */
  date: string;
  minC: number;
  maxC: number;
  /** Degree-days earned on this day. Never negative. */
  gdd: number;
  /** Running total from the first day of the window through this one. */
  cumulative: number;
}

export interface GddAccumulation {
  days: GddDay[];
  /** Total degree-days across the window. */
  total: number;
  base: number;
  upper?: number;
  /** Days in the payload that had no usable pair of extremes. */
  skipped: number;
}

/**
 * Degree-days for a single day.
 *
 * Clamped at zero: a day colder than the base does not *remove* accumulated
 * development, and a scorer that let it go negative would report a crop moving
 * backwards through its stages after a cold snap.
 *
 * Argument order is `(min, max)` to match how the daily payload names them; a
 * caller that swaps them gets the same answer, because the method averages.
 */
export function growingDegreeDays(
  minC: number,
  maxC: number,
  options: GddOptions = {},
): number {
  const { base = DEFAULT_BASE_TEMPERATURE_C, upper } = options;

  if (!Number.isFinite(minC) || !Number.isFinite(maxC) || !Number.isFinite(base)) {
    return 0;
  }

  let low = Math.min(minC, maxC);
  let high = Math.max(minC, maxC);

  if (upper !== undefined && Number.isFinite(upper)) {
    // Modified method: clamp both extremes into the crop's working range first.
    low = Math.min(Math.max(low, base), upper);
    high = Math.min(Math.max(high, base), upper);
  }

  return Math.max(0, (low + high) / 2 - base);
}

/**
 * Accumulate degree-days across a daily forecast window.
 *
 * Days whose extremes are missing are **skipped and counted**, not treated as
 * zero: a gap in the model is not a day without growth, and silently scoring it
 * as zero would understate the total by exactly the amount nobody notices.
 * `skipped` is reported so the caller can caveat the figure.
 */
export function accumulateGdd(
  daily:
    | {
        time?: string[];
        temperature_2m_min?: (number | null)[];
        temperature_2m_max?: (number | null)[];
      }
    | undefined,
  options: GddOptions = {},
): GddAccumulation {
  const { base = DEFAULT_BASE_TEMPERATURE_C, upper } = options;
  const days: GddDay[] = [];
  let cumulative = 0;
  let skipped = 0;

  const time = daily?.time ?? [];
  const mins = daily?.temperature_2m_min ?? [];
  const maxes = daily?.temperature_2m_max ?? [];

  for (let i = 0; i < time.length; i += 1) {
    const minC = mins[i];
    const maxC = maxes[i];

    if (
      typeof minC !== "number" ||
      typeof maxC !== "number" ||
      !Number.isFinite(minC) ||
      !Number.isFinite(maxC)
    ) {
      skipped += 1;
      continue;
    }

    const gdd = growingDegreeDays(minC, maxC, { base, upper });
    cumulative += gdd;
    days.push({ date: time[i], minC, maxC, gdd, cumulative });
  }

  return { days, total: cumulative, base, upper, skipped };
}

/**
 * A crop stage reached at a GDD total, for the common base-10 crops.
 *
 * Advisory and generic — real thresholds vary by cultivar, and this is a
 * seven-day forecast window rather than an accumulation from planting, so it
 * describes *this week's* contribution and not a crop's actual stage. Worded
 * to say so.
 */
export function describeAccumulation(accumulation: GddAccumulation): string {
  const { total, days, base } = accumulation;

  if (days.length === 0) {
    return "No daily temperatures in this forecast, so no degree-days to report.";
  }

  const perDay = total / days.length;
  const window = `${days.length} day${days.length === 1 ? "" : "s"}`;

  if (perDay < 1) {
    return `Effectively no development at base ${base}°C — this ${window} is too cold for a warm-season crop to move.`;
  }
  if (perDay < 5) {
    return `Slow accumulation, about ${perDay.toFixed(1)} degree-days a day. Expect development to lag the calendar.`;
  }
  if (perDay < 12) {
    return `Steady accumulation, about ${perDay.toFixed(1)} degree-days a day — an ordinary growing week at base ${base}°C.`;
  }
  return `Fast accumulation, about ${perDay.toFixed(1)} degree-days a day. Stages will arrive earlier than the calendar suggests; check irrigation keeps up.`;
}
