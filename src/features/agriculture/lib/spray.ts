/**
 * Spray-window advice: a go / caution / no-go for putting product on a crop.
 *
 * Deterministic rules against published label guidance, not a model. The four
 * inputs are the four things every product label conditions on — wind,
 * imminent rain, humidity and temperature — and each has both a floor and a
 * ceiling, which is the part that surprises people:
 *
 * - **Wind has a lower limit as well as an upper one.** Below about 2 km/h the
 *   air is likely to be stably stratified (a temperature inversion), and fine
 *   droplets that would normally settle instead hang and then drift a long way
 *   sideways when the inversion breaks. "Dead calm" is a drift hazard, not the
 *   ideal condition it is usually assumed to be.
 * - **Low humidity is a hazard too.** Below ~40% RH, fine droplets evaporate
 *   before they land, which both loses product and makes what is left more
 *   driftable.
 *
 * Thresholds are advisory and generic. A specific product's label wins over
 * anything here, and the advice text says so.
 */

import type { RiskLevel } from "@/shared/types/weather";

export type SprayVerdict = "go" | "caution" | "no-go";

export interface SprayConditions {
  /** Surface wind, km/h — Open-Meteo's `wind_speed_10m`. */
  windSpeedKmh: number | null | undefined;
  /** Chance of precipitation, percent, over the hour being judged. */
  precipitationProbability: number | null | undefined;
  /** Relative humidity, percent. */
  relativeHumidity: number | null | undefined;
  /** Air temperature, °C. */
  temperatureC: number | null | undefined;
}

export interface SprayAssessment {
  verdict: SprayVerdict;
  risk: RiskLevel;
  /** One line per condition that pushed the verdict off "go". */
  reasons: string[];
  /** The single sentence to put on a tile. */
  summary: string;
}

// Wind, km/h.
const WIND_INVERSION_BELOW = 2;
const WIND_IDEAL_MAX = 15;
const WIND_MARGINAL_MAX = 20;

// Precipitation probability, percent.
const RAIN_MARGINAL_ABOVE = 30;
const RAIN_STOP_ABOVE = 60;

// Relative humidity, percent.
const HUMIDITY_EVAPORATION_BELOW = 40;
const HUMIDITY_SLOW_DRYING_ABOVE = 95;

// Air temperature, °C.
const TEMP_VOLATILISATION_ABOVE = 28;
const TEMP_STOP_ABOVE = 32;

/**
 * Judge one set of conditions.
 *
 * A missing reading is a **caution, never a go**: the whole point of the
 * assessment is that four things have to be true at once, and three of four
 * known is not the same as four of four. That is the same rule the marine
 * advice follows, for the same reason.
 */
export function assessSprayConditions(
  conditions: SprayConditions,
): SprayAssessment {
  const wind = finite(conditions.windSpeedKmh);
  const rain = finite(conditions.precipitationProbability);
  const humidity = finite(conditions.relativeHumidity);
  const temp = finite(conditions.temperatureC);

  const reasons: string[] = [];
  // Two flags rather than a mutable verdict: a stop always outranks a caution,
  // whatever order the checks below happen to run in.
  let stopped = false;
  let cautioned = false;

  const stop = (reason: string) => {
    reasons.push(reason);
    stopped = true;
  };
  const caution = (reason: string) => {
    reasons.push(reason);
    cautioned = true;
  };

  // --- Wind -----------------------------------------------------------------
  if (wind == null) {
    caution("No wind reading — wind decides both drift and coverage.");
  } else if (wind > WIND_MARGINAL_MAX) {
    stop(`Wind ${wind.toFixed(0)} km/h — above ${WIND_MARGINAL_MAX} km/h, drift is unavoidable.`);
  } else if (wind > WIND_IDEAL_MAX) {
    caution(
      `Wind ${wind.toFixed(0)} km/h — past the ${WIND_IDEAL_MAX} km/h ideal. Coarse droplets and a low boom only.`,
    );
  } else if (wind < WIND_INVERSION_BELOW) {
    caution(
      `Wind ${wind.toFixed(1)} km/h — near calm suggests a temperature inversion, where fine droplets hang and then drift a long way.`,
    );
  }

  // --- Rain -----------------------------------------------------------------
  if (rain == null) {
    caution("No precipitation probability — check the rainfast period on the label.");
  } else if (rain > RAIN_STOP_ABOVE) {
    stop(`${rain.toFixed(0)}% chance of rain — likely wash-off before the product is rainfast.`);
  } else if (rain > RAIN_MARGINAL_ABOVE) {
    caution(
      `${rain.toFixed(0)}% chance of rain — check the product's rainfast period against the forecast.`,
    );
  }

  // --- Humidity -------------------------------------------------------------
  if (humidity == null) {
    caution("No humidity reading — humidity governs droplet survival.");
  } else if (humidity < HUMIDITY_EVAPORATION_BELOW) {
    caution(
      `${humidity.toFixed(0)}% humidity — fine droplets evaporate before they land. Increase droplet size.`,
    );
  } else if (humidity > HUMIDITY_SLOW_DRYING_ABOVE) {
    caution(
      `${humidity.toFixed(0)}% humidity — very slow drying, and near-saturated air often accompanies an inversion.`,
    );
  }

  // --- Temperature ----------------------------------------------------------
  if (temp == null) {
    caution("No temperature reading — volatilisation risk cannot be judged.");
  } else if (temp > TEMP_STOP_ABOVE) {
    stop(`${temp.toFixed(0)}°C — too hot. Volatilisation and crop scorch are both likely.`);
  } else if (temp > TEMP_VOLATILISATION_ABOVE) {
    caution(`${temp.toFixed(0)}°C — volatile products will lift off the leaf. Spray earlier or later.`);
  }

  const verdict: SprayVerdict = stopped ? "no-go" : cautioned ? "caution" : "go";

  const risk: RiskLevel =
    verdict === "no-go" ? "high" : verdict === "caution" ? "moderate" : "low";

  const summary =
    verdict === "go"
      ? "Conditions suit spraying. The product label still has the final word."
      : verdict === "caution"
        ? "Sprayable with care — one or more conditions are outside the ideal band."
        : "Do not spray in these conditions.";

  return { verdict, risk, reasons, summary };
}

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface SprayWindow {
  /** Index into the hourly series where the window starts. */
  startIndex: number;
  /** Index of the last hour in the window, inclusive. */
  endIndex: number;
  /** ISO timestamps from the series, for display. */
  startTime: string;
  endTime: string;
  /** The weakest verdict anywhere inside the window. */
  verdict: Exclude<SprayVerdict, "no-go">;
  hours: number;
}

export interface HourlySprayInput {
  time?: string[];
  wind_speed_10m?: (number | null)[];
  precipitation_probability?: (number | null)[];
  relative_humidity_2m?: (number | null)[];
  temperature_2m?: (number | null)[];
}

/**
 * Find the runs of consecutive sprayable hours in an hourly forecast.
 *
 * Returns windows in the order they occur, "go" runs and "caution" runs kept
 * separate — a two-hour clean window and a two-hour marginal one either side of
 * it are three different answers to "when can I spray", not one five-hour
 * answer.
 *
 * `fromIndex` lets a caller skip the hours already gone. A `minimumHours` of 2
 * is the default because a one-hour window is not enough time to fill, travel
 * and spray.
 */
export function findSprayWindows(
  hourly: HourlySprayInput | undefined,
  options: { fromIndex?: number; hours?: number; minimumHours?: number } = {},
): SprayWindow[] {
  const { fromIndex = 0, hours = 48, minimumHours = 2 } = options;

  const time = hourly?.time ?? [];
  const end = Math.min(time.length, fromIndex + hours);
  const windows: SprayWindow[] = [];

  let runStart = -1;
  let runVerdict: Exclude<SprayVerdict, "no-go"> = "go";

  const close = (lastIndex: number) => {
    if (runStart < 0) return;
    const length = lastIndex - runStart + 1;
    if (length >= minimumHours) {
      windows.push({
        startIndex: runStart,
        endIndex: lastIndex,
        startTime: time[runStart],
        endTime: time[lastIndex],
        verdict: runVerdict,
        hours: length,
      });
    }
    runStart = -1;
  };

  for (let i = fromIndex; i < end; i += 1) {
    const { verdict } = assessSprayConditions({
      windSpeedKmh: hourly?.wind_speed_10m?.[i],
      precipitationProbability: hourly?.precipitation_probability?.[i],
      relativeHumidity: hourly?.relative_humidity_2m?.[i],
      temperatureC: hourly?.temperature_2m?.[i],
    });

    if (verdict === "no-go") {
      close(i - 1);
      continue;
    }

    // A change of verdict ends one window and starts another, so a clean run
    // is never reported as if the marginal hours beside it were clean too.
    if (runStart >= 0 && verdict !== runVerdict) {
      close(i - 1);
    }
    if (runStart < 0) {
      runStart = i;
      runVerdict = verdict;
    }
  }
  close(end - 1);

  return windows;
}
