import { RISK_LEVELS } from "@/shared/types/weather";
import type {
  CurrentWeather,
  DailyWeatherWithAstronomy,
  HourlyWeather,
  RiskLevel,
  UserProfile,
  WeatherAlert,
} from "@/shared/types/weather";
import type { AppPreferences } from "@/store/slices/preferencesSlice";

/**
 * Turning a forecast into Alerts — pure, deterministic, no network and no
 * store.
 *
 * Not a model. Every threshold below is a published or conventional figure
 * named in the comment above it, and the whole file is `if` branches over
 * metric readings. See `CONTEXT.md` on why nothing here is called AI or a
 * prediction.
 *
 * **Every threshold is compared against the metric value**, always. Unit
 * conversion is a display step that happens in `@/shared/lib/units` at the
 * moment a number becomes a string — comparing against a converted value would
 * make the same forecast alert differently depending on a display preference.
 */

/** Derived from the preference rather than redeclared, so the two cannot drift. */
export type AlertSensitivity = AppPreferences["alertSensitivity"];

/**
 * A derived alert carries a four-step `level` alongside `WeatherAlert.type`.
 *
 * `type` is the three-step `"info" | "warning" | "danger"` the slice and the
 * notification settings have always used, and it stays. `level` is the display
 * scale `RiskGauge` and the `risk` palette speak. They are **different scales**
 * and this is additive: three members cannot be mapped onto four without
 * inventing a band, so both are carried and neither is derived from the other
 * by position.
 */
export interface DerivedAlert extends WeatherAlert {
  level: RiskLevel;
}

/**
 * The four-step level of an alert, whichever shape it arrives in.
 *
 * A freshly derived alert carries `level`. One rehydrated from a persisted
 * store, or built by anything that only knows `WeatherAlert`, does not — so
 * this discriminates with an `in` check, the same way `AdviceCard` tells the
 * four analysis shapes apart.
 *
 * **The fallback cannot produce `"severe"`.** Three members do not carry enough
 * information to recover four, and inventing the fourth would claim a severity
 * nothing measured. A `"danger"` with no `level` reads as `"high"`, which is
 * the cautious direction: it under-states a severe alert rather than promoting
 * an ordinary one.
 */
export function alertLevel(alert: WeatherAlert): RiskLevel {
  if ("level" in alert) {
    const level = (alert as { level?: unknown }).level;
    if (
      typeof level === "string" &&
      (RISK_LEVELS as readonly string[]).includes(level)
    ) {
      return level as RiskLevel;
    }
  }

  if (alert.type === "danger") return "high";
  if (alert.type === "warning") return "moderate";
  return "low";
}

/** The minimum a forecast has to carry to be scanned. Both `WeatherResponse`
 * and the general dashboard's widened response satisfy it structurally. */
export interface AlertSource {
  current?: CurrentWeather;
  hourly?: HourlyWeather;
  daily?: DailyWeatherWithAstronomy;
}

export interface DeriveAlertsOptions {
  sensitivity?: AlertSensitivity;
  /** Stamped on each alert. The lens the alert was raised for. */
  profile?: UserProfile;
  /** Hours of the hourly series to scan ahead. */
  hours?: number;
  /**
   * Used for `timestamp` and for the id suffix, so the same forecast derives
   * the same ids twice and a dismissal is not undone by a refetch.
   */
  now?: Date;
}

/**
 * Sensitivity as a multiplier on every **magnitude** threshold.
 *
 * Above 1 means a bigger reading is needed, so fewer alerts: "low sensitivity"
 * is a quieter app, not a lower bar. The scale is deliberately mild — 20% —
 * because these thresholds mark real hazard boundaries and a preference should
 * shift the edge, not move it into a different category of weather.
 */
const MAGNITUDE_SCALE: Record<AlertSensitivity, number> = {
  low: 1.2,
  medium: 1,
  high: 0.8,
};

/**
 * Sensitivity on temperature, as an **offset in °C rather than a multiplier**.
 *
 * Multiplying a temperature is meaningless — it depends entirely on the zero
 * point of the scale, so scaling -10 °C and 35 °C by the same factor moves them
 * by 2 °C and 7 °C respectively, and scaling anything near 0 °C does nothing at
 * all. The offset widens the heat threshold up and the cold threshold down by
 * the same amount, which is what "less sensitive" actually means here.
 */
const TEMPERATURE_OFFSET_C: Record<AlertSensitivity, number> = {
  low: 3,
  medium: 0,
  high: -3,
};

// ---------------------------------------------------------------------------
// Thresholds — all metric, all named
// ---------------------------------------------------------------------------

/**
 * Beaufort force 8 (gale, 62 km/h) and force 10 (storm, 89 km/h). Force 8 is
 * where twigs break off trees and walking becomes difficult; force 10 is where
 * the scale's own description begins mentioning structural damage.
 */
const WIND_GALE_KMH = 62;
const WIND_STORM_KMH = 89;

/**
 * AMS rainfall-rate classes: "heavy rain" from 7.6 mm/h, "violent rain" from
 * 50 mm/h. Compared against the **peak hourly rate**, not the daily total —
 * 30 mm spread over a day is a wet day, and 30 mm in one hour is a flash flood.
 */
const RAIN_HEAVY_MM_PER_H = 7.6;
const RAIN_VIOLENT_MM_PER_H = 50;

/**
 * The two heat-health levels most European national services warn on: 35 °C
 * for a warning and 40 °C for the top level. Compared against the daily maximum.
 */
const HEAT_WARNING_C = 35;
const HEAT_DANGER_C = 40;

/**
 * Cold-health levels. These are a convention rather than a single published
 * standard — services differ by climate, and -10 °C means something different
 * in Sofia and in Tromsø — but they are the figures cold-weather plans
 * commonly use, and stating that is better than implying a citation there
 * isn't. Compared against the daily minimum.
 */
const COLD_WARNING_C = -10;
const COLD_DANGER_C = -20;

/**
 * WHO Global Solar UV Index: 8 is the bottom of "very high", 11 the bottom of
 * "extreme". Compared against the daily maximum.
 */
const UV_WARNING = 8;
const UV_DANGER = 11;

/** WMO codes for thunderstorms: 95 plain, 96 with slight hail, 99 with heavy
 * hail. The numbers are not ordered by severity, so these are listed, never
 * compared with a range. */
const THUNDER_CODE = 95;
const HAIL_CODES = [96, 99];

const DEFAULT_HOURS = 24;

// ---------------------------------------------------------------------------

/** The type a level reports as, for the notification settings and the slice. */
function alertTypeFor(level: RiskLevel): WeatherAlert["type"] {
  if (level === "severe" || level === "high") return "danger";
  if (level === "moderate") return "warning";
  return "info";
}

/** Finite readings only — Open-Meteo drops a variable it has no data for, and
 * `undefined` in an arithmetic comparison is silently false either way. */
function finiteValues(series: (number | null | undefined)[] | undefined): number[] {
  if (!series) return [];
  return series.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  );
}

/**
 * A stable id: kind plus the local day the reading falls on.
 *
 * Stable is the whole requirement. The derivation runs on every refetch, so an
 * id containing a timestamp would produce a new alert every few minutes — which
 * defeats dismissal, defeats read state, and fills the history in an afternoon.
 */
function alertId(kind: string, day: string): string {
  return `${kind}-${day}`;
}

/**
 * Alerts for genuine threshold breaches in a forecast.
 *
 * Returns a whole list rather than emitting one at a time, so a caller can
 * `setAlerts` and have breaches that have *passed* disappear — an alert that
 * can only ever be added is an alert that never goes away.
 */
export function deriveAlerts(
  forecast: AlertSource | undefined,
  options: DeriveAlertsOptions = {},
): DerivedAlert[] {
  if (!forecast) return [];

  const {
    sensitivity = "medium",
    profile = "general",
    hours = DEFAULT_HOURS,
    now = new Date(),
  } = options;

  const scale = MAGNITUDE_SCALE[sensitivity] ?? 1;
  const offset = TEMPERATURE_OFFSET_C[sensitivity] ?? 0;
  const timestamp = now.toISOString();

  const { hourly, daily } = forecast;
  // The day an alert is keyed to. The daily block's own first entry when there
  // is one, so two clients in different timezones derive the same id for the
  // same forecast; the viewer's date only as a last resort.
  const day = daily?.time?.[0] ?? timestamp.slice(0, 10);

  const alerts: DerivedAlert[] = [];

  const push = (
    kind: string,
    level: RiskLevel,
    title: string,
    message: string,
    conditions: Record<string, unknown>,
  ) => {
    alerts.push({
      id: alertId(kind, day),
      type: alertTypeFor(level),
      level,
      profile,
      title,
      message,
      timestamp,
      conditions,
    });
  };

  // --- Severe weather codes -------------------------------------------------
  //
  // Categorical, so the sensitivity multiplier does not apply — a thunderstorm
  // is not 20% more of a thunderstorm. What sensitivity does here is decide
  // whether a plain storm is worth raising at all; hail always is.
  const codes = finiteValues(hourly?.weather_code?.slice(0, hours));
  const currentCode = forecast.current?.weather_code;
  const allCodes = currentCode !== undefined ? [...codes, currentCode] : codes;

  if (allCodes.some((code) => HAIL_CODES.includes(code))) {
    push(
      "thunderstorm-hail",
      "severe",
      "Thunderstorm with hail",
      `Hail is forecast within the next ${hours} hours. Get vehicles and anything breakable under cover, and stay indoors while it passes.`,
      { weatherCodes: HAIL_CODES, windowHours: hours },
    );
  } else if (
    allCodes.includes(THUNDER_CODE) &&
    sensitivity !== "low"
  ) {
    push(
      "thunderstorm",
      "high",
      "Thunderstorm forecast",
      `Thunderstorms are forecast within the next ${hours} hours. Avoid exposed ground and open water while they pass.`,
      { weatherCode: THUNDER_CODE, windowHours: hours },
    );
  }

  // --- Damaging wind --------------------------------------------------------
  const winds = finiteValues(hourly?.wind_speed_10m?.slice(0, hours));
  const dailyMaxWind = finiteValues(daily?.wind_speed_10m_max?.slice(0, 1));
  const peakWind = Math.max(0, ...winds, ...dailyMaxWind);

  if (peakWind >= WIND_STORM_KMH * scale) {
    push(
      "wind-storm",
      "severe",
      "Storm-force wind",
      `Winds are forecast to reach ${Math.round(peakWind)} km/h — Beaufort force 10. Expect damage to trees and structures; do not go out in it if you can avoid it.`,
      { peakWindKmh: peakWind, thresholdKmh: WIND_STORM_KMH * scale },
    );
  } else if (peakWind >= WIND_GALE_KMH * scale) {
    push(
      "wind-gale",
      "high",
      "Gale-force wind",
      `Winds are forecast to reach ${Math.round(peakWind)} km/h — Beaufort force 8. Secure loose objects outside and expect difficulty walking in exposed places.`,
      { peakWindKmh: peakWind, thresholdKmh: WIND_GALE_KMH * scale },
    );
  }

  // --- Heavy precipitation --------------------------------------------------
  const rates = finiteValues(hourly?.precipitation?.slice(0, hours));
  const peakRate = rates.length > 0 ? Math.max(...rates) : 0;

  if (peakRate >= RAIN_VIOLENT_MM_PER_H * scale) {
    push(
      "rain-violent",
      "severe",
      "Torrential rain",
      `Up to ${peakRate.toFixed(1)} mm of rain in a single hour is forecast. That is flash-flood rate — stay away from watercourses and underpasses.`,
      { peakRateMmPerHour: peakRate, thresholdMmPerHour: RAIN_VIOLENT_MM_PER_H * scale },
    );
  } else if (peakRate >= RAIN_HEAVY_MM_PER_H * scale) {
    push(
      "rain-heavy",
      "high",
      "Heavy rain",
      `Up to ${peakRate.toFixed(1)} mm of rain in a single hour is forecast. Expect standing water and slow going on the roads.`,
      { peakRateMmPerHour: peakRate, thresholdMmPerHour: RAIN_HEAVY_MM_PER_H * scale },
    );
  }

  // --- Extreme heat ---------------------------------------------------------
  const maxTemps = finiteValues(daily?.temperature_2m_max?.slice(0, 1));
  const peakTemp = maxTemps.length > 0 ? Math.max(...maxTemps) : null;

  if (peakTemp !== null) {
    if (peakTemp >= HEAT_DANGER_C + offset) {
      push(
        "heat-extreme",
        "severe",
        "Extreme heat",
        `Today reaches ${Math.round(peakTemp)} °C. Stay out of the sun between 11:00 and 17:00, drink more than you feel like, and check on anyone elderly.`,
        { maxTemperatureC: peakTemp, thresholdC: HEAT_DANGER_C + offset },
      );
    } else if (peakTemp >= HEAT_WARNING_C + offset) {
      push(
        "heat-high",
        "high",
        "High temperatures",
        `Today reaches ${Math.round(peakTemp)} °C. Keep water with you and avoid hard exertion in the afternoon.`,
        { maxTemperatureC: peakTemp, thresholdC: HEAT_WARNING_C + offset },
      );
    }
  }

  // --- Extreme cold ---------------------------------------------------------
  const minTemps = finiteValues(daily?.temperature_2m_min?.slice(0, 1));
  const lowTemp = minTemps.length > 0 ? Math.min(...minTemps) : null;

  if (lowTemp !== null) {
    if (lowTemp <= COLD_DANGER_C - offset) {
      push(
        "cold-extreme",
        "severe",
        "Extreme cold",
        `Tonight drops to ${Math.round(lowTemp)} °C. Exposed skin is at risk within minutes — cover everything and limit time outside.`,
        { minTemperatureC: lowTemp, thresholdC: COLD_DANGER_C - offset },
      );
    } else if (lowTemp <= COLD_WARNING_C - offset) {
      push(
        "cold-high",
        "high",
        "Severe cold",
        `Tonight drops to ${Math.round(lowTemp)} °C. Layer up, cover your hands and face, and protect pipes and plants.`,
        { minTemperatureC: lowTemp, thresholdC: COLD_WARNING_C - offset },
      );
    }
  }

  // --- UV -------------------------------------------------------------------
  const uvValues = finiteValues(daily?.uv_index_max?.slice(0, 1));
  const peakUv = uvValues.length > 0 ? Math.max(...uvValues) : null;

  if (peakUv !== null) {
    if (peakUv >= UV_DANGER * scale) {
      push(
        "uv-extreme",
        "severe",
        "Extreme UV",
        `The UV index peaks at ${peakUv.toFixed(1)} today — the top of the WHO scale. Unprotected skin burns in minutes; stay in the shade through the middle of the day.`,
        { maxUvIndex: peakUv, threshold: UV_DANGER * scale },
      );
    } else if (peakUv >= UV_WARNING * scale) {
      push(
        "uv-very-high",
        "high",
        "Very high UV",
        `The UV index peaks at ${peakUv.toFixed(1)} today. Shirt, hat and sunscreen if you are out between 11:00 and 15:00.`,
        { maxUvIndex: peakUv, threshold: UV_WARNING * scale },
      );
    }
  }

  return alerts;
}
