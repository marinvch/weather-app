import {
  beaufortFromKmh,
  douglasFromWaveHeight,
  swellSeparation,
  waterTemperatureReading,
} from "@/features/marine/lib/seaState";
import { currentHourIndex, readingsAt } from "@/features/marine/lib/readings";
import { degreesToCardinal } from "@/shared/lib/units";
import type { MarineAnalysis, MarineResponse } from "@/shared/types/weather";

/**
 * "Is it worth putting to sea?" — deterministic, rule-based scoring.
 *
 * Not a model and not a prediction. Every branch below is a hand-written `if`
 * against a published scale, and `confidence` is a hand-assigned constant that
 * describes how much of the picture the rules looked at, not a measured
 * certainty. Say so wherever it is displayed.
 *
 * Pure: takes a payload, returns advice. No network, no store, no clock beyond
 * the injectable `now`.
 *
 * ## The safety rule
 *
 * Missing data never scores as good conditions. A null wave height means the
 * marine model has nothing here, not that the sea is flat — so the analysis
 * says it cannot advise rather than producing a cheerful "excellent" from
 * zeroes. That substitution ("|| 0" on a null reading) is what this rewrite
 * removed: it told an inland user, and anyone at the edge of coverage, that
 * conditions were ideal.
 */
export interface AdviseMarineOptions {
  /**
   * Surface wind in **km/h** from the ordinary forecast host. The marine host
   * does not report wind, so without this the Beaufort half of the advice is
   * simply absent rather than guessed.
   */
  windSpeedKmh?: number | null;
  /** Meteorological bearing the wind comes from, degrees. */
  windDirectionDegrees?: number | null;
  /** Injectable for tests; defaults to the real clock. */
  now?: Date;
}

/** The shape returned when there is nothing to advise on. */
function noData(reason: string): MarineAnalysis {
  return {
    recommendation: "No sea state available for this location",
    confidence: 0,
    reasoning: reason,
    riskLevel: "medium",
    profileSpecificTips: [
      "Check an official forecast for the sea area before going out.",
    ],
    fishingConditions: "poor",
    seaState: "Unknown",
    waveAnalysis: "No wave data at this coordinate.",
  };
}

export const adviseMarine = (
  marine: MarineResponse,
  options: AdviseMarineOptions = {},
): MarineAnalysis => {
  const { windSpeedKmh = null, windDirectionDegrees = null, now } = options;

  const times = marine.hourly?.time;
  if (!times || times.length === 0) {
    return noData("The marine response carried no hourly series.");
  }

  const index = currentHourIndex(times.length, now);
  const r = readingsAt(marine, index);

  const sea = douglasFromWaveHeight(r.waveHeight);
  if (!sea) {
    // The series exists but this coordinate has no wave data — inland, or off
    // the edge of the model. Advising "calm" here would be the worst possible
    // answer, so advise nothing.
    return noData(
      "The marine model returned no wave height for this coordinate, which usually means it is inland or outside coverage.",
    );
  }

  const wind = beaufortFromKmh(windSpeedKmh);
  const water = waterTemperatureReading(r.seaSurfaceTemperature);
  const split = swellSeparation(r.swellHeight, r.windWaveHeight);

  /** A height, or an honest admission there isn't one. Never a stand-in zero. */
  const waveText = (value: number | null) =>
    value == null ? "no reading" : `${value.toFixed(1)} m`;

  const tips: string[] = [];

  // -------------------------------------------------------------------------
  // Risk, taken as the worst of the inputs that are present.
  //
  // Deliberately not an average. A gale over a slight sea is still a gale, and
  // averaging it against a calm swell reading is how a scorer talks someone
  // into going out.
  // -------------------------------------------------------------------------
  const ORDER = { low: 0, moderate: 1, high: 2, severe: 3 } as const;
  const worst = [sea.risk, wind?.risk, water?.risk]
    .filter((level): level is NonNullable<typeof level> => level != null)
    .reduce((a, b) => (ORDER[a] >= ORDER[b] ? a : b), "low" as const);

  // The Analysis scale is the older three-step one. "severe" and "high" both
  // land on "high" here; the four-step reading is carried by `seaState` and by
  // the dashboard's gauge, which reads the Douglas degree directly.
  const riskLevel: MarineAnalysis["riskLevel"] =
    worst === "severe" || worst === "high"
      ? "high"
      : worst === "moderate"
        ? "medium"
        : "low";

  // -------------------------------------------------------------------------
  // Fishing conditions — a small-boat judgement, keyed off the Douglas degree.
  // Degree 4 (1.25 m) is roughly where an open boat stops being pleasant and
  // degree 5 (2.5 m) is where it stops being sensible.
  // -------------------------------------------------------------------------
  let fishingConditions: MarineAnalysis["fishingConditions"];
  if (sea.degree >= 5) {
    fishingConditions = "poor";
    tips.push(
      `${sea.label} sea at ${waveText(r.waveHeight)} — postpone the trip.`,
    );
  } else if (sea.degree === 4) {
    fishingConditions = "fair";
    tips.push("Moderate sea with frequent whitecaps — experienced crews only.");
  } else if (sea.degree <= 2) {
    fishingConditions = "excellent";
    tips.push("Sea is smooth or better — good conditions for a small boat.");
  } else {
    fishingConditions = "good";
    tips.push("Slight sea — workable for most craft.");
  }

  if (wind) {
    if (wind.force >= 8) {
      tips.push(`Force ${wind.force} ${wind.label.toLowerCase()} — do not put to sea.`);
    } else if (wind.force >= 6) {
      tips.push(
        `Force ${wind.force} ${wind.label.toLowerCase()} — small-craft warning territory.`,
      );
      if (fishingConditions === "excellent" || fishingConditions === "good") {
        // A flat sea under a strong breeze means the wind has only just got up
        // and the sea has not built yet. It will.
        fishingConditions = "fair";
        tips.push(
          "The sea has not caught up with the wind yet — expect it to build.",
        );
      }
    } else if (wind.force >= 4 && windDirectionDegrees != null) {
      tips.push(
        `Force ${wind.force} from the ${degreesToCardinal(windDirectionDegrees)} — plan the return leg into it.`,
      );
    }
  }

  if (split?.composition === "wind-dominated" && sea.degree >= 3) {
    tips.push(
      "Short, steep wind wave rather than swell — a wetter, harder ride than the height suggests.",
    );
  } else if (split?.composition === "mixed" && sea.degree >= 3) {
    tips.push("Swell and wind wave crossing — expect a confused sea.");
  }

  if (water) tips.push(water.advice);

  if (r.currentVelocity != null && r.currentVelocity > 1.5) {
    const bearing =
      r.currentDirection != null
        ? ` setting ${degreesToCardinal(r.currentDirection)}`
        : "";
    tips.push(
      `Strong current at ${r.currentVelocity.toFixed(1)} km/h${bearing} — allow for the set.`,
    );
  }

  // -------------------------------------------------------------------------
  // Best window: the calmest hour of the next twelve, read from the series
  // rather than asserted. "Early morning is calmer" is folklore; the forecast
  // knows.
  // -------------------------------------------------------------------------
  const bestTimeForActivity = calmestWindow(marine, index, now);

  return {
    recommendation: `${sea.label} sea, ${waveText(r.waveHeight)}${
      wind ? `, force ${wind.force} ${wind.label.toLowerCase()}` : ""
    } — ${fishingConditions} conditions for a small boat.`,
    // A hand-assigned constant, higher when the wind half of the picture is
    // present. Not a measurement.
    confidence: wind ? 85 : 70,
    reasoning: [
      `Douglas degree ${sea.degree} (${sea.label}) from ${waveText(r.waveHeight)} significant wave height`,
      wind ? `Beaufort force ${wind.force} from ${Math.round(windSpeedKmh ?? 0)} km/h` : null,
      r.seaSurfaceTemperature != null
        ? `sea surface ${r.seaSurfaceTemperature.toFixed(1)}°C`
        : null,
      r.wavePeriod != null ? `period ${r.wavePeriod.toFixed(1)} s` : null,
    ]
      .filter(Boolean)
      .join(", "),
    riskLevel,
    profileSpecificTips: tips,
    bestTimeForActivity,
    fishingConditions,
    seaState: `${sea.label} (Douglas ${sea.degree})`,
    waveAnalysis: [
      `Significant ${waveText(r.waveHeight)}`,
      `swell ${waveText(r.swellHeight)}${
        r.swellDirection != null ? ` from the ${degreesToCardinal(r.swellDirection)}` : ""
      }`,
      `wind wave ${waveText(r.windWaveHeight)}`,
      split?.description,
    ]
      .filter(Boolean)
      .join(". "),
    tideRecommendation:
      r.currentVelocity != null && r.currentVelocity > 1
        ? "Strong tidal flow — time the passage with the stream, not against it."
        : undefined,
  };
};

/**
 * The calmest hour in the next twelve, as a local time string.
 *
 * Returns a plain sentence rather than `undefined` when the series is too short
 * or has no further readings, because the field is rendered as prose.
 */
function calmestWindow(
  marine: MarineResponse,
  fromIndex: number,
  now?: Date,
): string {
  const heights = marine.hourly?.wave_height;
  const times = marine.hourly?.time;
  if (!heights || !times) return "No further readings in this forecast.";

  let bestIndex = -1;
  let bestHeight = Number.POSITIVE_INFINITY;

  for (let i = fromIndex; i < Math.min(fromIndex + 12, times.length); i += 1) {
    const value = heights[i];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value < bestHeight) {
      bestHeight = value;
      bestIndex = i;
    }
  }

  if (bestIndex < 0) return "No further readings in this forecast.";
  if (bestIndex === fromIndex) {
    return `Now — nothing calmer in the next 12 hours (${bestHeight.toFixed(1)} m).`;
  }

  const when = times[bestIndex];
  const parsed = new Date(when);
  const label = Number.isNaN(parsed.getTime())
    ? when
    : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // `now` is accepted for symmetry with the rest of the module; the label comes
  // from the series' own timestamp, so it needs no clock of its own.
  void now;

  return `Around ${label}, when the sea drops to ${bestHeight.toFixed(1)} m.`;
}
