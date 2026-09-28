/**
 * WMO weather code presentation — the single source of truth for what a code
 * *looks and reads like*.
 *
 * Open-Meteo reports conditions as WMO 4677 codes, an integer per hour. The
 * numbers are not ordered by severity (48 rime fog sits between 45 fog and 51
 * drizzle), and they are sparse — 4, 5 and 6 do not exist — so nothing may
 * infer meaning from the integer itself. Everything comes from this table.
 *
 * `severity` here is *presentation* severity: how much visual weight the
 * condition should be given. It is not a risk score. Risk is per-persona and
 * lives in each feature's `lib/advice.ts`, because 25 kt of wind is a good day
 * for a sailor and a bad one for an agronomist.
 *
 * `@/shared/types/weather` also exports a `weatherCodes` map of description and
 * emoji, which predates this file and is what `WeatherCard` renders. This is
 * the richer replacement; the two agree on wording where they overlap.
 */

export type ConditionGroup =
  | "clear"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

export interface ConditionInfo {
  /** The WMO code this describes — echoed back so a lookup result is complete. */
  code: number;
  label: string;
  group: ConditionGroup;
  /** Presentation weight, 0 benign to 3 hazardous. Not a risk score. */
  severity: 0 | 1 | 2 | 3;
}

/**
 * The full WMO 4677 subset Open-Meteo emits.
 *
 * Freezing precipitation (56, 57, 66, 67) is graded high regardless of
 * intensity: it is the ice, not the rate, that closes a road.
 */
const CONDITIONS: Record<number, Omit<ConditionInfo, "code">> = {
  0: { label: "Clear sky", group: "clear", severity: 0 },
  1: { label: "Mainly clear", group: "clear", severity: 0 },
  2: { label: "Partly cloudy", group: "cloud", severity: 0 },
  3: { label: "Overcast", group: "cloud", severity: 1 },

  45: { label: "Fog", group: "fog", severity: 1 },
  48: { label: "Depositing rime fog", group: "fog", severity: 2 },

  51: { label: "Light drizzle", group: "drizzle", severity: 1 },
  53: { label: "Moderate drizzle", group: "drizzle", severity: 1 },
  55: { label: "Dense drizzle", group: "drizzle", severity: 2 },
  56: { label: "Light freezing drizzle", group: "drizzle", severity: 2 },
  57: { label: "Dense freezing drizzle", group: "drizzle", severity: 3 },

  61: { label: "Slight rain", group: "rain", severity: 1 },
  63: { label: "Moderate rain", group: "rain", severity: 2 },
  65: { label: "Heavy rain", group: "rain", severity: 3 },
  66: { label: "Light freezing rain", group: "rain", severity: 3 },
  67: { label: "Heavy freezing rain", group: "rain", severity: 3 },

  71: { label: "Slight snowfall", group: "snow", severity: 1 },
  73: { label: "Moderate snowfall", group: "snow", severity: 2 },
  75: { label: "Heavy snowfall", group: "snow", severity: 3 },
  77: { label: "Snow grains", group: "snow", severity: 1 },

  80: { label: "Slight rain showers", group: "rain", severity: 1 },
  81: { label: "Moderate rain showers", group: "rain", severity: 2 },
  82: { label: "Violent rain showers", group: "rain", severity: 3 },

  85: { label: "Slight snow showers", group: "snow", severity: 2 },
  86: { label: "Heavy snow showers", group: "snow", severity: 3 },

  95: { label: "Thunderstorm", group: "thunder", severity: 3 },
  96: { label: "Thunderstorm with slight hail", group: "thunder", severity: 3 },
  99: { label: "Thunderstorm with heavy hail", group: "thunder", severity: 3 },
};

/**
 * The answer for a code that is not in the table.
 *
 * `severity: 1` rather than 0 on purpose. A code we cannot read is not evidence
 * of a calm sky, and rendering an unknown as "benign" is the one failure that
 * misleads someone about to go out in it. Grouped as `cloud` because that is
 * the visually neutral backdrop — not a claim about the sky.
 */
const UNKNOWN: Omit<ConditionInfo, "code"> = {
  label: "Unknown conditions",
  group: "cloud",
  severity: 1,
};

/**
 * Look up a WMO code. Total: any integer answers, including ones Open-Meteo
 * does not currently emit and any it starts emitting later.
 */
export function conditionFromCode(code: number): ConditionInfo {
  return { code, ...(CONDITIONS[code] ?? UNKNOWN) };
}

// ---------------------------------------------------------------------------
// Sky gradients
// ---------------------------------------------------------------------------

/**
 * Fixed hex pairs, deliberately outside the palette.
 *
 * A hero gradient is a picture of the sky, not a themed surface: it has to look
 * like weather in both colour schemes, so it does not follow the scheme. What
 * *does* follow is the text laid over it, which is why every pair below is dark
 * enough to carry white text at any point along the ramp — checked at both
 * stops, not just the average.
 */
const GRADIENTS: Record<ConditionGroup, { day: [string, string]; night: [string, string] }> = {
  clear: {
    day: ["#0B79C4", "#37B4E8"],
    night: ["#081A33", "#123A66"],
  },
  cloud: {
    day: ["#4A6B84", "#7E9BB0"],
    night: ["#111C28", "#2A3D4F"],
  },
  fog: {
    day: ["#5C6B75", "#93A2AB"],
    night: ["#151C21", "#333F48"],
  },
  drizzle: {
    day: ["#3E6480", "#6E93AB"],
    night: ["#0E1A24", "#263C4E"],
  },
  rain: {
    day: ["#2A4E66", "#4E7591"],
    night: ["#0A141C", "#1D3243"],
  },
  snow: {
    day: ["#5E7A91", "#A7BCCB"],
    night: ["#141E28", "#33475A"],
  },
  thunder: {
    day: ["#2B2740", "#4E4468"],
    night: ["#0D0B16", "#292139"],
  },
};

/**
 * A CSS gradient for a hero background, chosen by condition and daylight.
 *
 * `isDay` comes straight from Open-Meteo's `is_day` (0 or 1) — pass
 * `Boolean(current.is_day)`. It matters more than the code does: a clear night
 * and a clear noon are the same condition and completely different pictures.
 *
 * 160deg rather than `to bottom` so the light source reads as off to one side,
 * which is what keeps a two-stop ramp from looking like a progress bar.
 */
export function skyGradient(code: number, isDay: boolean): string {
  const { group } = conditionFromCode(code);
  const [from, to] = GRADIENTS[group][isDay ? "day" : "night"];
  return `linear-gradient(160deg, ${from} 0%, ${to} 100%)`;
}
