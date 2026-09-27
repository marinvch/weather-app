/**
 * Air quality, UV and pollen interpretation — pure, deterministic, testable.
 *
 * Not a model. Every number below is a published threshold named in the comment
 * above it, and every band is a hand-written comparison. Nothing here predicts
 * anything: it reads a measurement and says which published band that
 * measurement falls in. See CONTEXT.md on why this is never called "AI".
 *
 * The interpretation lives in the feature rather than beside the transport in
 * `@/shared/api/airQualityApi`, because an AQI of 60 is a shrug to a mariner
 * and a stay-indoors to someone with asthma — the number is shared, the reading
 * of it is not.
 */

import type { AirQualityCurrent, RiskLevel } from "@/shared/types/weather";

// ---------------------------------------------------------------------------
// European AQI
// ---------------------------------------------------------------------------

export type AqiBand =
  | "good"
  | "fair"
  | "moderate"
  | "poor"
  | "very-poor"
  | "extremely-poor";

export interface AqiReading {
  band: AqiBand;
  /** The four-step display scale from `@/shared/types/weather`. */
  level: RiskLevel;
  label: string;
  guidance: string;
}

/**
 * The European AQI band edges (EEA / CAMS): 0-20 good, 20-40 fair, 40-60
 * moderate, 60-80 poor, 80-100 very poor, above 100 extremely poor.
 *
 * Each edge belongs to the band **above** it — an index of exactly 20 is
 * "fair", not "good". That is how the EEA defines the scale, and it is the only
 * boundary rule under which the six bands neither overlap nor leave a gap.
 */
const AQI_EDGES: readonly { max: number; band: AqiBand }[] = [
  { max: 20, band: "good" },
  { max: 40, band: "fair" },
  { max: 60, band: "moderate" },
  { max: 80, band: "poor" },
  { max: 100, band: "very-poor" },
] as const;

/**
 * Six published bands onto the app's four display steps.
 *
 * "good" and "fair" both land on `low` because neither carries advice for the
 * general population — the EEA guidance for both is to carry on as usual.
 * "very poor" and "extremely poor" both land on `severe` for the opposite
 * reason: above 80 the advice stops changing, it is already "stay indoors".
 * Collapsing six onto four loses no actionable distinction.
 */
const AQI_BANDS: Record<AqiBand, Omit<AqiReading, "band">> = {
  good: {
    level: "low",
    label: "Good",
    guidance: "Air quality is good. Enjoy your usual outdoor activities.",
  },
  fair: {
    level: "low",
    label: "Fair",
    guidance:
      "Air quality is acceptable. Unusually sensitive people should watch for symptoms.",
  },
  moderate: {
    level: "moderate",
    label: "Moderate",
    guidance:
      "Consider easing off intense outdoor exercise if you have asthma or a heart condition.",
  },
  poor: {
    level: "high",
    label: "Poor",
    guidance:
      "Sensitive groups should cut back on outdoor exertion. Everyone else should take it easy.",
  },
  "very-poor": {
    level: "severe",
    label: "Very poor",
    guidance:
      "Sensitive groups should stay indoors. Everyone should avoid strenuous activity outside.",
  },
  "extremely-poor": {
    level: "severe",
    label: "Extremely poor",
    guidance:
      "Stay indoors and keep windows closed. Avoid all outdoor exertion.",
  },
};

/**
 * Read a European AQI index value into its band, display level and guidance.
 *
 * The input is the index itself (Open-Meteo `european_aqi`), not a
 * concentration — the two are different scales, and passing a micrograms figure
 * here reads an ordinary PM10 day as "extremely poor" by accident.
 *
 * A non-finite or negative value reads as `good` rather than throwing: this
 * runs behind a render, and the caller has already decided the field is
 * present. A caller that means "no reading" hides the tile instead.
 */
export function europeanAqiBand(aqi: number): AqiReading {
  if (!Number.isFinite(aqi) || aqi < 0) {
    return { band: "good", ...AQI_BANDS.good };
  }
  const match = AQI_EDGES.find((edge) => aqi < edge.max);
  const band = match?.band ?? "extremely-poor";
  return { band, ...AQI_BANDS[band] };
}

// ---------------------------------------------------------------------------
// Sub-indices and the dominant pollutant
// ---------------------------------------------------------------------------

/**
 * The five pollutants the European AQI is computed from. Carbon monoxide is
 * deliberately absent: the European index does not include it, so it has no
 * sub-index and cannot be the dominant pollutant however high it reads.
 * Open-Meteo still reports it and the panel still shows it — it just does not
 * compete for the headline.
 */
export type AqiPollutant =
  | "pm2_5"
  | "pm10"
  | "nitrogen_dioxide"
  | "ozone"
  | "sulphur_dioxide";

export const POLLUTANT_LABEL: Record<AqiPollutant, string> = {
  pm2_5: "PM2.5",
  pm10: "PM10",
  nitrogen_dioxide: "Nitrogen dioxide",
  ozone: "Ozone",
  sulphur_dioxide: "Sulphur dioxide",
};

/**
 * The EEA per-pollutant concentration breakpoints, in **micrograms per cubic
 * metre**, at the same six band edges as the index itself. Position *n* of each
 * array is the upper concentration of the band whose index ceiling is
 * `SUB_INDEX_TOPS[n]`.
 *
 * The overall European AQI is defined as the **worst** of these five
 * sub-indices, not their average — which is what makes "dominant pollutant" a
 * real quantity rather than a ranking invented for this screen.
 */
const POLLUTANT_BREAKPOINTS: Record<AqiPollutant, readonly number[]> = {
  pm2_5: [10, 20, 25, 50, 75, 800],
  pm10: [20, 40, 50, 100, 150, 1200],
  nitrogen_dioxide: [40, 90, 120, 230, 340, 1000],
  ozone: [50, 100, 130, 240, 380, 800],
  sulphur_dioxide: [100, 200, 350, 500, 750, 1250],
};

/**
 * The index at the top of each band. The last entry is 150 for an open-ended
 * top band that has no defined ceiling — see `pollutantSubIndex`.
 */
const SUB_INDEX_TOPS = [20, 40, 60, 80, 100, 150] as const;

/**
 * The European AQI sub-index for one pollutant at one concentration.
 *
 * Piecewise-linear inside each band, which is how the EEA defines it. A
 * concentration above the top breakpoint clamps to 150 rather than
 * extrapolating: the scale is open-ended above 100, so an extrapolated figure
 * would be a number this app made up.
 */
export function pollutantSubIndex(
  pollutant: AqiPollutant,
  concentration: number,
): number {
  if (!Number.isFinite(concentration) || concentration <= 0) return 0;

  const breakpoints = POLLUTANT_BREAKPOINTS[pollutant];
  let lowConcentration = 0;
  let lowIndex = 0;

  for (let i = 0; i < breakpoints.length; i += 1) {
    const highConcentration = breakpoints[i];
    const highIndex = SUB_INDEX_TOPS[i];

    if (concentration <= highConcentration) {
      const span = highConcentration - lowConcentration;
      const ratio = span === 0 ? 0 : (concentration - lowConcentration) / span;
      return lowIndex + ratio * (highIndex - lowIndex);
    }

    lowConcentration = highConcentration;
    lowIndex = highIndex;
  }

  return SUB_INDEX_TOPS[SUB_INDEX_TOPS.length - 1];
}

export interface DominantPollutant {
  pollutant: AqiPollutant;
  label: string;
  /** Micrograms per cubic metre, as reported. */
  concentration: number;
  /** Its European AQI sub-index — the figure that made it dominant. */
  subIndex: number;
}

/**
 * Which pollutant is driving the index right now.
 *
 * `null` when the payload carries none of the five, which is a real case rather
 * than a defensive one: the air quality API answers with only the variables
 * that were asked for and drops any it has no data for at that coordinate.
 */
export function dominantPollutant(
  current: AirQualityCurrent | undefined,
): DominantPollutant | null {
  if (!current) return null;

  let worst: DominantPollutant | null = null;

  for (const pollutant of Object.keys(
    POLLUTANT_BREAKPOINTS,
  ) as AqiPollutant[]) {
    const concentration = current[pollutant];
    if (concentration === undefined || concentration === null) continue;
    if (!Number.isFinite(concentration)) continue;

    const subIndex = pollutantSubIndex(pollutant, concentration);
    if (!worst || subIndex > worst.subIndex) {
      worst = {
        pollutant,
        label: POLLUTANT_LABEL[pollutant],
        concentration,
        subIndex,
      };
    }
  }

  return worst;
}

// ---------------------------------------------------------------------------
// UV index
// ---------------------------------------------------------------------------

export type UvBand = "low" | "moderate" | "high" | "very-high" | "extreme";

export interface UvReading {
  band: UvBand;
  level: RiskLevel;
  label: string;
  guidance: string;
  /**
   * Minutes of unprotected midday sun before fair skin (Fitzpatrick type II)
   * reddens. Absent below UV 1, where the answer is "longer than you will be
   * outside" and a figure would imply a precision the scale does not have.
   */
  burnMinutes?: number;
}

/**
 * The WHO Global Solar UV Index bands: below 3 low, 3 to 6 moderate, 6 to 8
 * high, 8 to 11 very high, 11 and above extreme. Each edge belongs to the band
 * above it, so a UV index of exactly 3 is moderate and exactly 11 is extreme.
 */
const UV_EDGES: readonly { max: number; band: UvBand }[] = [
  { max: 3, band: "low" },
  { max: 6, band: "moderate" },
  { max: 8, band: "high" },
  { max: 11, band: "very-high" },
] as const;

const UV_BANDS: Record<UvBand, Omit<UvReading, "band" | "burnMinutes">> = {
  low: {
    level: "low",
    label: "Low",
    guidance: "No protection needed for most people.",
  },
  moderate: {
    level: "moderate",
    label: "Moderate",
    guidance:
      "Seek shade near midday. Sunscreen and a hat if you are out for a while.",
  },
  high: {
    level: "high",
    label: "High",
    guidance:
      "Cover up, wear sunscreen and a hat, and stay in the shade near midday.",
  },
  "very-high": {
    level: "severe",
    label: "Very high",
    guidance:
      "Avoid the sun between 11:00 and 15:00. Shirt, sunscreen and hat are essential.",
  },
  extreme: {
    level: "severe",
    label: "Extreme",
    guidance:
      "Unprotected skin burns in minutes. Stay indoors through the middle of the day.",
  },
};

/**
 * Seconds to a minimal erythemal dose at UV index 1 — the constant the burn
 * time is derived from rather than tabulated.
 *
 * One UV index unit is 25 mW/m2 of erythemally weighted irradiance by
 * definition, and one MED for Fitzpatrick type II skin is about 250 J/m2. Time
 * to burn is therefore 250 / (uv * 0.025) seconds, which is 10000/uv seconds or
 * 166.7/uv minutes. That puts UV 8 at about 21 minutes and UV 11 at about 15 —
 * the same figures the published burn-time tables give, because they come from
 * these same two constants.
 */
const MED_SECONDS_AT_UV_1 = 10000;

/** Read a UV index into its WHO band, display level, guidance and burn time. */
export function uvBand(uvIndex: number): UvReading {
  if (!Number.isFinite(uvIndex) || uvIndex < 0) {
    return { band: "low", ...UV_BANDS.low };
  }

  const match = UV_EDGES.find((edge) => uvIndex < edge.max);
  const band = match?.band ?? "extreme";
  const reading: UvReading = { band, ...UV_BANDS[band] };

  if (uvIndex >= 1) {
    reading.burnMinutes = Math.round(MED_SECONDS_AT_UV_1 / uvIndex / 60);
  }

  return reading;
}

// ---------------------------------------------------------------------------
// Pollen
// ---------------------------------------------------------------------------

export type PollenBand = "none" | "low" | "moderate" | "high" | "very-high";

export interface PollenReading {
  band: PollenBand;
  level: RiskLevel;
  label: string;
  guidance: string;
}

/**
 * The Met Office grass-pollen bands, in **grains per cubic metre**: below 30
 * low, 30 to 50 moderate, 50 to 150 high, 150 and above very high. Zero gets
 * its own "none" band so a reading of exactly nothing does not render as "low".
 *
 * Applied to every species Open-Meteo reports, which is a simplification worth
 * stating: a birch count of 50 provokes symptoms in more people than a grass
 * count of 50, so these bands run slightly optimistic for tree pollen. They are
 * the right order of magnitude for all six, and a per-species table would be
 * five different scales the UI has no room to explain.
 */
const POLLEN_EDGES: readonly { max: number; band: PollenBand }[] = [
  { max: 30, band: "low" },
  { max: 50, band: "moderate" },
  { max: 150, band: "high" },
] as const;

const POLLEN_BANDS: Record<PollenBand, Omit<PollenReading, "band">> = {
  none: {
    level: "low",
    label: "None",
    guidance: "No pollen detected for this species.",
  },
  low: {
    level: "low",
    label: "Low",
    guidance: "Most people with allergies will not notice this.",
  },
  moderate: {
    level: "moderate",
    label: "Moderate",
    guidance: "Take antihistamines before going out if you are sensitive.",
  },
  high: {
    level: "high",
    label: "High",
    guidance:
      "Keep windows shut, and shower and change after a long spell outside.",
  },
  "very-high": {
    level: "severe",
    label: "Very high",
    guidance:
      "Stay indoors where you can. Symptoms are likely even with medication.",
  },
};

/** Read a pollen count in grains per cubic metre into its band. */
export function pollenBand(grains: number): PollenReading {
  if (!Number.isFinite(grains) || grains <= 0) {
    return { band: "none", ...POLLEN_BANDS.none };
  }
  const match = POLLEN_EDGES.find((edge) => grains < edge.max);
  const band = match?.band ?? "very-high";
  return { band, ...POLLEN_BANDS[band] };
}

/**
 * The six species Open-Meteo carries. **Europe only** — outside the CAMS
 * European domain every one of these comes back absent, so a caller reads
 * "missing" as "not covered here" and hides the section, rather than rendering
 * a row of nulls.
 */
export const POLLEN_SPECIES = [
  "alder_pollen",
  "birch_pollen",
  "grass_pollen",
  "mugwort_pollen",
  "olive_pollen",
  "ragweed_pollen",
] as const;

export type PollenSpecies = (typeof POLLEN_SPECIES)[number];

export const POLLEN_LABEL: Record<PollenSpecies, string> = {
  alder_pollen: "Alder",
  birch_pollen: "Birch",
  grass_pollen: "Grass",
  mugwort_pollen: "Mugwort",
  olive_pollen: "Olive",
  ragweed_pollen: "Ragweed",
};

export interface SpeciesPollenReading extends PollenReading {
  species: PollenSpecies;
  speciesLabel: string;
  /** Grains per cubic metre, as reported. */
  grains: number;
}

/**
 * Every species the payload actually carries, worst first.
 *
 * An empty array means "this coordinate is outside the pollen domain, hide the
 * section" — not "no pollen today". The two are different answers and the UI
 * must not conflate them, which is why an absent field is dropped here rather
 * than defaulted to zero.
 */
export function pollenReadings(
  current: AirQualityCurrent | undefined,
): SpeciesPollenReading[] {
  if (!current) return [];

  return POLLEN_SPECIES.flatMap((species) => {
    const grains = current[species];
    if (grains === undefined || grains === null) return [];
    if (!Number.isFinite(grains)) return [];
    return [
      {
        species,
        speciesLabel: POLLEN_LABEL[species],
        grains,
        ...pollenBand(grains),
      },
    ];
  }).sort((a, b) => b.grains - a.grains);
}
