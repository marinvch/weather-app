/**
 * Condition readings for the mountain dashboard.
 *
 * ## The two avalanche scorers, and how they were reconciled
 *
 * There are two, and they used to disagree: `avalancheRisk` below accumulates
 * points across temperature, wind and precipitation, while `adviseMountain`
 * classified from single thresholds (a 0–3°C melt-freeze band, weather code
 * > 70). The same conditions could read "Low" in the tile and "high" in the
 * advice card directly beneath it — heavy snowfall at −10°C did exactly that.
 *
 * **`avalancheReading` is now the single source of truth** and both consumers
 * derive from it. Neither scorer's numbers were changed and neither was
 * deleted: the reading takes **the more severe of the two**, on the bands'
 * shared names. That is a composition rule, not a new threshold — no number
 * here is invented, and the safety-biased direction is the only one that can be
 * chosen without someone deciding which scorer is right, which is a domain
 * question this file cannot answer.
 *
 * The consequence, stated plainly: the tile now *escalates* where the threshold
 * scorer was the stricter of the two. It never de-escalates.
 *
 * Severity here is this feature's **own** scale, not the shared `RiskLevel` —
 * see the note on `Severity` below.
 */

import type { RiskLevel } from "@/shared/types/weather";

/**
 * This feature's own four-step severity scale.
 *
 * **Not** `RiskLevel` from `@/shared/types/weather`, and deliberately not
 * migrated onto it. Four steps, but not the same four: "medium" and "extreme"
 * are this scale's words for its own bands, and the shared scale exists to
 * drive the risk palette rather than to describe a mountain. Conversion happens
 * at the display boundary — `riskLevelFromSeverity` and `tileSeverity` at the
 * foot of this file — through named records, never an array index.
 *
 * Two other unrelated types are also called `Severity`: agriculture's, which
 * has three members, and the numeric `0 | 1 | 2 | 3` exported by
 * `@/shared/ui/MetricTile`. Importing more than one into a file needs an alias,
 * and getting it wrong type-errors as though the member list were wrong rather
 * than the name.
 */
export type Severity = "low" | "medium" | "high" | "extreme";

export interface WindCondition {
  text: string;
  severity: Severity;
}

/** Wind speed in km/h to a plain-language reading. */
export function windCondition(speed: number): WindCondition {
  if (speed < 20) return { text: "Calm", severity: "low" };
  if (speed < 40) return { text: "Breezy", severity: "medium" };
  if (speed < 60) return { text: "Windy", severity: "high" };
  return { text: "Dangerous", severity: "extreme" };
}

export interface VisibilityCondition {
  text: string;
  cause: string;
  severity: Severity;
}

/** WMO weather code to a visibility reading. */
export function visibilityCondition(weatherCode: number): VisibilityCondition {
  if ([45, 48].includes(weatherCode)) {
    return { text: "Poor", cause: "Fog", severity: "high" };
  }
  if ([51, 53, 55, 61, 63, 65].includes(weatherCode)) {
    return { text: "Reduced", cause: "Rain", severity: "medium" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return { text: "Poor", cause: "Snow", severity: "high" };
  }
  return { text: "Good", cause: "Clear conditions", severity: "low" };
}

export interface AvalancheReading {
  level: string;
  description: string;
  severity: Severity;
}

/**
 * Points-based avalanche reading — one of the two scorers.
 *
 * Unchanged, and still exported and tested on its own, so the composition in
 * `avalancheReading` can be read against each half. Call `avalancheReading`
 * rather than this to display anything.
 */
export function avalancheRisk(
  temp: number,
  windSpeed: number,
  weatherCode: number,
): AvalancheReading {
  let risk = 0;

  // Near freezing: melt-freeze cycling weakens the pack.
  if (temp > -2 && temp < 2) risk += 2;
  if (temp > 0) risk += 1;

  // Wind loads lee slopes.
  if (windSpeed > 40) risk += 2;
  if (windSpeed > 60) risk += 1;

  // Fresh snow.
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) risk += 2;
  // Rain on snow.
  if ([61, 63, 65].includes(weatherCode) && temp < 5) risk += 1;

  if (risk <= 2) {
    return {
      level: "Low",
      description: "Generally safe conditions",
      severity: "low",
    };
  }
  if (risk <= 4) {
    return {
      level: "Moderate",
      description: "Use caution on steep slopes",
      severity: "medium",
    };
  }
  if (risk <= 6) {
    return {
      level: "High",
      description: "Avoid steep terrain",
      severity: "high",
    };
  }
  return {
    level: "Extreme",
    description: "Travel not recommended",
    severity: "extreme",
  };
}

/**
 * The **European Avalanche Danger Scale**, five steps, as published by EAWS.
 *
 * This is the scale `MountainAnalysis.avalancheRisk` is typed on and it is a
 * domain scale, not a display one — "considerable" is EADS level 3 and has no
 * equivalent in the shared four-step `RiskLevel`. Collapsing it in either
 * direction changes an avalanche-safety statement, so it is never assigned
 * across.
 */
export type AvalancheDanger =
  | "low"
  | "moderate"
  | "considerable"
  | "high"
  | "extreme";

/** EADS order, for comparing two readings. Index is the published level − 1. */
const DANGER_ORDER: Record<AvalancheDanger, number> = {
  low: 0,
  moderate: 1,
  considerable: 2,
  high: 3,
  extreme: 4,
};

/**
 * The threshold-based scorer — the second of the two, lifted out of
 * `adviseMountain` unchanged so both live side by side and neither can be
 * edited without the other being visible.
 *
 * A 0–3°C melt-freeze band, and any weather code above 70. The code test is
 * broad: it catches thunderstorms (95–99) as well as snow, which is unlikely to
 * be intended but is the long-standing behaviour and is pinned by a test in
 * `advice.test.ts`. Changing it is a threshold change, not a refactor.
 */
export function avalancheThresholdDanger(
  temp: number,
  weatherCode: number,
): AvalancheDanger {
  if (weatherCode > 70) return "high";
  if (temp > 0 && temp < 3) return "moderate";
  return "low";
}

/**
 * The band names the points scorer produces, as EADS levels.
 *
 * A name-for-name correspondence, not a remapping: the points scorer's four
 * bands are spelled "Low", "Moderate", "High" and "Extreme", which are four of
 * the five EADS words verbatim. Nothing is renumbered. "considerable" is simply
 * not reachable from the points side, which is also true of the threshold side.
 */
const POINTS_BAND_TO_DANGER: Record<string, AvalancheDanger> = {
  Low: "low",
  Moderate: "moderate",
  High: "high",
  Extreme: "extreme",
};

export interface AvalancheAssessment {
  /** The published EADS level — what `MountainAnalysis.avalancheRisk` carries. */
  danger: AvalancheDanger;
  /** Title-case label for a heading: "Low", "Considerable". */
  level: string;
  description: string;
  severity: Severity;
}

/** What each EADS level means for a party on the hill. */
const DANGER_COPY: Record<
  AvalancheDanger,
  { level: string; description: string; severity: Severity }
> = {
  low: {
    level: "Low",
    description: "Generally safe conditions",
    severity: "low",
  },
  moderate: {
    level: "Moderate",
    description: "Use caution on steep slopes",
    severity: "medium",
  },
  considerable: {
    level: "Considerable",
    description: "Careful route selection needed; human-triggered releases likely",
    severity: "high",
  },
  high: {
    level: "High",
    description: "Avoid steep terrain",
    severity: "high",
  },
  extreme: {
    level: "Extreme",
    description: "Travel not recommended",
    severity: "extreme",
  },
};

/**
 * **The single source of truth for avalanche danger.** Both the tile and the
 * advice card derive from this; neither scores it independently any more.
 *
 * The more severe of the points-based and threshold-based scorers, on the EADS
 * ordering. Taking the worse of two rather than averaging them, for the same
 * reason the marine advice does: a snowfall warning that one scorer raises is
 * not cancelled by another scorer that did not look at snowfall.
 */
export function avalancheReading(
  temp: number,
  windSpeed: number,
  weatherCode: number,
): AvalancheAssessment {
  const points = avalancheRisk(temp, windSpeed, weatherCode);
  const fromPoints = POINTS_BAND_TO_DANGER[points.level] ?? "low";
  const fromThreshold = avalancheThresholdDanger(temp, weatherCode);

  const danger =
    DANGER_ORDER[fromPoints] >= DANGER_ORDER[fromThreshold]
      ? fromPoints
      : fromThreshold;

  return { danger, ...DANGER_COPY[danger] };
}

// ---------------------------------------------------------------------------
// Wind chill
// ---------------------------------------------------------------------------

/**
 * Wind chill in °C, by the North American **JAG/TI** formula (Environment
 * Canada / NWS, 2001):
 *
 * ```
 * T_wc = 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16
 * ```
 *
 * with air temperature `T` in °C and wind speed `V` in **km/h at 10 m** —
 * which is exactly what Open-Meteo's `wind_speed_10m` is, so nothing is
 * converted on the way in.
 *
 * The formula is only defined for **T ≤ 10 °C and V > 4.8 km/h**. Outside that
 * it produces nonsense — it will happily report a wind chill *above* the air
 * temperature at 20 °C — so out of range this returns the air temperature
 * unchanged rather than an invented number. A caller wanting to know whether a
 * chill applies at all should ask `windChillApplies`.
 */
export function windChill(celsius: number, windKmh: number): number {
  if (!Number.isFinite(celsius) || !Number.isFinite(windKmh)) return celsius;
  if (!windChillApplies(celsius, windKmh)) return celsius;

  const v = Math.pow(windKmh, 0.16);
  return 13.12 + 0.6215 * celsius - 11.37 * v + 0.3965 * celsius * v;
}

/** Is the wind chill formula defined for these conditions? */
export function windChillApplies(celsius: number, windKmh: number): boolean {
  return celsius <= 10 && windKmh > 4.8;
}

export interface ExposureReading {
  text: string;
  /** What to do about it, in a sentence. */
  advice: string;
  severity: Severity;
}

/**
 * Frostbite exposure from a wind chill value, banded on the Environment Canada
 * frostbite table — the time to freeze exposed skin, which is the number that
 * decides what a party can safely do rather than how cold it feels.
 */
export function exposureFromWindChill(chillCelsius: number): ExposureReading {
  if (!Number.isFinite(chillCelsius)) {
    return {
      text: "Unknown",
      advice: "No temperature reading for this point.",
      severity: "medium",
    };
  }
  if (chillCelsius <= -48) {
    return {
      text: "Frostbite in under 2 minutes",
      advice: "Exposed skin freezes almost immediately. Do not go above the treeline.",
      severity: "extreme",
    };
  }
  if (chillCelsius <= -38) {
    return {
      text: "Frostbite in 5 to 10 minutes",
      advice: "Cover every square centimetre of skin and keep the party moving.",
      severity: "extreme",
    };
  }
  if (chillCelsius <= -28) {
    return {
      text: "Frostbite in 10 to 30 minutes",
      advice: "Goggles and a face covering. Check each other's faces at every stop.",
      severity: "high",
    };
  }
  if (chillCelsius <= -10) {
    return {
      text: "Uncomfortable, frostbite unlikely",
      advice: "Windproof outer layer and gloves; frostbite needs prolonged exposure.",
      severity: "medium",
    };
  }
  return {
    text: "Low exposure risk",
    advice: "Ordinary layering is enough for the wind at this temperature.",
    severity: "low",
  };
}

// ---------------------------------------------------------------------------
// Freezing level
// ---------------------------------------------------------------------------

export interface FreezingLevelReading {
  /** Metres above sea level where the air reaches 0 °C. */
  heightMetres: number;
  /** Metres of the reading relative to the terrain — negative means below you. */
  aboveTerrainMetres: number;
  text: string;
  advice: string;
  severity: Severity;
}

/**
 * Where the 0 °C isotherm sits relative to the ground under your feet.
 *
 * Both figures are **metres above sea level**, so the subtraction is the whole
 * calculation — nothing here converts anything. The reading a mountaineer wants
 * is the sign and the margin: a freezing level *below* the terrain means
 * everything above is frozen, verglas is likely and any melt from the day
 * refreezes overnight. A freezing level a few hundred metres above the ground
 * is the dangerous middle, where the snowpack is wet and unstable at the exact
 * altitude most routes cross.
 */
export function freezingLevelReading(
  freezingLevelMetres: number | null | undefined,
  terrainElevationMetres: number | null | undefined,
): FreezingLevelReading | null {
  if (
    freezingLevelMetres == null ||
    terrainElevationMetres == null ||
    !Number.isFinite(freezingLevelMetres) ||
    !Number.isFinite(terrainElevationMetres)
  ) {
    return null;
  }

  const aboveTerrainMetres = freezingLevelMetres - terrainElevationMetres;

  if (aboveTerrainMetres <= 0) {
    return {
      heightMetres: freezingLevelMetres,
      aboveTerrainMetres,
      text: "Below the ground here",
      advice:
        "Everything at and above this point is below freezing. Expect verglas and frozen ground; carry crampons.",
      severity: "high",
    };
  }
  if (aboveTerrainMetres <= 500) {
    return {
      heightMetres: freezingLevelMetres,
      aboveTerrainMetres,
      text: `${Math.round(aboveTerrainMetres)} m above the ground`,
      advice:
        "The freezing level cuts through the route. The snowpack will be wet below it and frozen above — the worst combination for wet-slab release.",
      severity: "high",
    };
  }
  if (aboveTerrainMetres <= 1500) {
    return {
      heightMetres: freezingLevelMetres,
      aboveTerrainMetres,
      text: `${Math.round(aboveTerrainMetres)} m above the ground`,
      advice:
        "Freezing level sits above the immediate terrain. Snow at altitude stays frozen; anything lower is thawing.",
      severity: "medium",
    };
  }
  return {
    heightMetres: freezingLevelMetres,
    aboveTerrainMetres,
    text: `${Math.round(aboveTerrainMetres)} m above the ground`,
    advice: "Freezing level well above the terrain. No frozen ground at this altitude.",
    severity: "low",
  };
}

// ---------------------------------------------------------------------------
// Snow depth
// ---------------------------------------------------------------------------

export interface SnowDepthReading {
  /** Centimetres. Open-Meteo reports `snow_depth` in metres; converted here. */
  centimetres: number;
  text: string;
  advice: string;
  severity: Severity;
}

/**
 * Snow depth from Open-Meteo's `snow_depth`, which is **metres**, not
 * centimetres — the one unit trap in this file. A 0.4 reading is 40 cm of
 * snow, and shown raw it reads as "0.4 cm", which is no snow at all.
 *
 * Severity rises with depth because depth is what makes travel slow and burial
 * possible, not because deep snow is unstable by itself — instability is the
 * avalanche calculation's job, and the two are deliberately separate.
 */
export function snowDepthReading(
  metresDeep: number | null | undefined,
): SnowDepthReading | null {
  if (metresDeep == null || !Number.isFinite(metresDeep) || metresDeep < 0) {
    return null;
  }

  const centimetres = metresDeep * 100;

  if (centimetres < 1) {
    return {
      centimetres,
      text: "Bare ground",
      advice: "No lying snow at this point.",
      severity: "low",
    };
  }
  if (centimetres < 30) {
    return {
      centimetres,
      text: "Thin cover",
      advice: "Enough to hide rock and hole. Watch your footing.",
      severity: "low",
    };
  }
  if (centimetres < 80) {
    return {
      centimetres,
      text: "Established snowpack",
      advice: "Snowshoes or skis will be faster than boots. Check the avalanche bulletin.",
      severity: "medium",
    };
  }
  if (centimetres < 200) {
    return {
      centimetres,
      text: "Deep snowpack",
      advice: "Trail-breaking is slow and burial is possible. Carry transceiver, probe and shovel.",
      severity: "high",
    };
  }
  return {
    centimetres,
    text: "Very deep snowpack",
    advice: "Serious winter mountaineering conditions. Full avalanche kit and the training to use it.",
    severity: "extreme",
  };
}

// ---------------------------------------------------------------------------
// The ascent wind profile
// ---------------------------------------------------------------------------

export interface AscentBand {
  /** Metres above ground level, as Open-Meteo names the level. */
  heightAgl: 10 | 80 | 120;
  label: string;
  /** What that band stands in for on a real hill. */
  sublabel: string;
  /** km/h, or null when the model did not return that level. */
  speedKmh: number | null;
  condition: WindCondition | null;
}

/**
 * The three wind levels Open-Meteo reports, as an ascent profile.
 *
 * These are heights **above ground**, not altitudes — 120 m AGL is not the
 * summit, it is the air 120 m over whatever terrain the model has at this
 * coordinate. It is a proxy for ridge exposure, because wind accelerates away
 * from surface friction in the same way it does over a ridge, and it is the
 * closest thing a point forecast gives you to what a col will feel like. The
 * sublabels say "conditions" rather than naming altitudes for that reason.
 *
 * Levels the response omits stay `null`. A missing level and a calm one must
 * not render the same.
 */
export function ascentWindProfile(current: {
  wind_speed_10m?: number;
  wind_speed_80m?: number;
  wind_speed_120m?: number;
}): AscentBand[] {
  const band = (
    heightAgl: 10 | 80 | 120,
    label: string,
    sublabel: string,
    speed: number | undefined,
  ): AscentBand => {
    const speedKmh =
      typeof speed === "number" && Number.isFinite(speed) ? speed : null;
    return {
      heightAgl,
      label,
      sublabel,
      speedKmh,
      condition: speedKmh == null ? null : windCondition(speedKmh),
    };
  };

  return [
    band(10, "Surface (10 m)", "Valley and approach", current.wind_speed_10m),
    band(80, "80 m above ground", "Shoulder and open slope", current.wind_speed_80m),
    band(120, "120 m above ground", "Ridge and col exposure", current.wind_speed_120m),
  ];
}

/**
 * How much the wind strengthens between the surface and the highest reported
 * level, as a multiple.
 *
 * The number that matters when a party is deciding whether a sheltered valley
 * reading is telling them anything about the ridge: a factor of 2 means the
 * col is twice the wind of the car park. Returns `null` when there is no upper
 * level, or when the surface is calm enough that the ratio is meaningless
 * — 1 km/h at the surface and 6 km/h aloft is a factor of six and not a warning
 * about anything.
 */
export function windAmplification(bands: AscentBand[]): number | null {
  const surface = bands.find((b) => b.heightAgl === 10)?.speedKmh;
  const aloft = [...bands]
    .reverse()
    .find((b) => b.heightAgl !== 10 && b.speedKmh != null)?.speedKmh;

  if (surface == null || aloft == null || surface < 5) return null;
  return aloft / surface;
}

// ---------------------------------------------------------------------------
// Display boundary
// ---------------------------------------------------------------------------

/**
 * This scale's words, mapped onto the shared display scale — **by name, one
 * entry at a time, never by array index.**
 *
 * The two scales happen to have four members each, so an index lookup would
 * compile and produce the right answer today. It would also silently produce
 * the wrong answer the moment either scale gains or loses a member, and it
 * reads as though the two scales were the same thing. They are not: this one
 * describes a mountain, and `RiskLevel` exists to pick a palette entry.
 */
const SEVERITY_TO_RISK_LEVEL: Record<Severity, RiskLevel> = {
  low: "low",
  medium: "moderate",
  high: "high",
  extreme: "severe",
};

/** Convert at the call site, for `RiskGauge`. Defaults to the calmest step. */
export function riskLevelFromSeverity(
  severity: Severity | undefined,
): RiskLevel {
  return severity ? SEVERITY_TO_RISK_LEVEL[severity] : "low";
}

/**
 * This scale's words as `MetricTile`'s numeric `severity` — again a named
 * record, for the same reason.
 */
const SEVERITY_TO_TILE: Record<Severity, 0 | 1 | 2 | 3> = {
  low: 0,
  medium: 1,
  high: 2,
  extreme: 3,
};

/** Convert at the call site, for `MetricTile`. Defaults to the calmest step. */
export function tileSeverity(severity: Severity | undefined): 0 | 1 | 2 | 3 {
  return severity ? SEVERITY_TO_TILE[severity] : 0;
}

/**
 * Read an hourly series at the current hour, narrowed to `number | null`.
 *
 * Open-Meteo omits whole series it has no data for, and a present series can
 * still carry a null at an individual hour — so `snow_depth[13]` is
 * `number | undefined` at runtime whatever the type says. The index is clamped
 * so a short window cannot index past the end.
 */
export function atCurrentHour(
  series: readonly (number | null | undefined)[] | undefined,
  now: Date = new Date(),
): number | null {
  if (!series || series.length === 0) return null;
  const index = Math.min(Math.max(now.getHours(), 0), series.length - 1);
  const value = series[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
