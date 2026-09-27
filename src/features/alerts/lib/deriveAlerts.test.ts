import { describe, it, expect } from "vitest";
import { alertLevel, deriveAlerts, type AlertSource } from "./deriveAlerts";
import type {
  CurrentWeather,
  DailyWeatherWithAstronomy,
  HourlyWeather,
  WeatherAlert,
} from "@/shared/types/weather";

/**
 * These rules decide whether someone is told to stay indoors. A threshold on
 * the wrong side of an edge is not a rendering bug — it is either a warning
 * that never fires, or one that fires on an ordinary Tuesday until the user
 * stops reading them.
 *
 * So the cases below are edges: the threshold, the value just under it, and the
 * sensitivity-shifted edge. Every reading is metric, because that is what the
 * thresholds are compared against.
 */

const NOW = new Date("2026-09-05T09:00:00Z");

function hourly(fields: Partial<HourlyWeather> = {}): HourlyWeather {
  const flat = (value: number) => Array.from({ length: 24 }, () => value);
  return {
    time: Array.from(
      { length: 24 },
      (_, hour) => `2026-09-05T${String(hour).padStart(2, "0")}:00`,
    ),
    temperature_2m: flat(20),
    precipitation_probability: flat(0),
    precipitation: flat(0),
    wind_speed_10m: flat(8),
    wind_direction_10m: flat(180),
    relative_humidity_2m: flat(50),
    weather_code: flat(0),
    ...fields,
  };
}

function daily(
  fields: Partial<DailyWeatherWithAstronomy> = {},
): DailyWeatherWithAstronomy {
  return {
    time: ["2026-09-05"],
    temperature_2m_max: [24],
    temperature_2m_min: [14],
    precipitation_sum: [0],
    wind_speed_10m_max: [12],
    weather_code: [0],
    sunrise: ["2026-09-05T06:42"],
    sunset: ["2026-09-05T19:54"],
    uv_index_max: [4],
    ...fields,
  };
}

function forecast(
  overrides: {
    hourly?: Partial<HourlyWeather>;
    daily?: Partial<DailyWeatherWithAstronomy>;
    current?: Partial<CurrentWeather>;
  } = {},
): AlertSource {
  return {
    hourly: hourly(overrides.hourly),
    daily: daily(overrides.daily),
    current: overrides.current
      ? ({
          time: "2026-09-05T09:00",
          temperature_2m: 20,
          relative_humidity_2m: 50,
          wind_speed_10m: 8,
          wind_direction_10m: 180,
          weather_code: 0,
          is_day: 1,
          ...overrides.current,
        } as CurrentWeather)
      : undefined,
  };
}

function kinds(source: AlertSource, options = {}) {
  return deriveAlerts(source, { now: NOW, ...options }).map((alert) => alert.id);
}

describe("deriveAlerts", () => {
  it("raises nothing for an ordinary day", () => {
    expect(deriveAlerts(forecast(), { now: NOW })).toEqual([]);
  });

  it("returns an empty list rather than throwing on a missing forecast", () => {
    expect(deriveAlerts(undefined)).toEqual([]);
    expect(deriveAlerts({})).toEqual([]);
  });

  it("survives a payload whose variables were never requested", () => {
    // Open-Meteo returns only what was asked for. An absent series must read
    // as "nothing to say", never as a zero that trips a cold or calm rule.
    expect(
      deriveAlerts(
        { daily: { ...daily(), uv_index_max: undefined } },
        { now: NOW },
      ),
    ).toEqual([]);
  });
});

describe("deriveAlerts — severe weather codes", () => {
  it("raises hail as severe, from the hourly series", () => {
    const alerts = deriveAlerts(
      forecast({ hourly: { weather_code: [0, 0, 96, 0] } }),
      { now: NOW },
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("thunderstorm-hail-2026-09-05");
    expect(alerts[0].level).toBe("severe");
    expect(alerts[0].type).toBe("danger");
  });

  it("treats 99 as hail too, and never infers severity from the number", () => {
    // The WMO codes are not ordered by severity, so this has to be a list
    // membership test rather than a range comparison.
    expect(
      kinds(forecast({ hourly: { weather_code: [99] } })),
    ).toContain("thunderstorm-hail-2026-09-05");
  });

  it("raises a plain thunderstorm as high, not severe", () => {
    const alerts = deriveAlerts(
      forecast({ hourly: { weather_code: [95] } }),
      { now: NOW },
    );

    expect(alerts[0].id).toBe("thunderstorm-2026-09-05");
    expect(alerts[0].level).toBe("high");
  });

  it("prefers the hail alert over the plain one rather than raising both", () => {
    expect(kinds(forecast({ hourly: { weather_code: [95, 96] } }))).toEqual([
      "thunderstorm-hail-2026-09-05",
    ]);
  });

  it("reads the current conditions as well as the forecast hours", () => {
    expect(
      kinds(
        forecast({ hourly: { weather_code: [0] }, current: { weather_code: 95 } }),
      ),
    ).toContain("thunderstorm-2026-09-05");
  });

  it("suppresses a plain storm at low sensitivity but never hail", () => {
    // Categorical rules are not scaled — a thunderstorm is not 20% more of a
    // thunderstorm. Sensitivity only decides whether a plain storm is worth
    // raising; hail always is.
    expect(
      kinds(forecast({ hourly: { weather_code: [95] } }), { sensitivity: "low" }),
    ).toEqual([]);
    expect(
      kinds(forecast({ hourly: { weather_code: [96] } }), { sensitivity: "low" }),
    ).toEqual(["thunderstorm-hail-2026-09-05"]);
  });

  it("only scans the requested window", () => {
    const codes = Array.from({ length: 24 }, (_, hour) => (hour === 20 ? 95 : 0));

    expect(kinds(forecast({ hourly: { weather_code: codes } }), { hours: 12 })).toEqual(
      [],
    );
    expect(
      kinds(forecast({ hourly: { weather_code: codes } }), { hours: 24 }),
    ).toContain("thunderstorm-2026-09-05");
  });
});

describe("deriveAlerts — wind", () => {
  const gust = (kmh: number) =>
    forecast({ hourly: { wind_speed_10m: [10, kmh, 10] } });

  it("raises a gale at Beaufort force 8 and not below", () => {
    expect(kinds(gust(61.9))).toEqual([]);
    expect(kinds(gust(62))).toEqual(["wind-gale-2026-09-05"]);
  });

  it("escalates to storm force at Beaufort 10", () => {
    expect(kinds(gust(88.9))).toEqual(["wind-gale-2026-09-05"]);
    expect(kinds(gust(89))).toEqual(["wind-storm-2026-09-05"]);
  });

  it("raises one wind alert, never both", () => {
    expect(kinds(gust(120))).toHaveLength(1);
  });

  it("reads the daily maximum as well as the hourly series", () => {
    expect(
      kinds(forecast({ daily: { wind_speed_10m_max: [95] } })),
    ).toEqual(["wind-storm-2026-09-05"]);
  });

  it("moves the threshold with sensitivity, in the direction the word means", () => {
    // "low sensitivity" is a quieter app: a bigger reading is needed. 62 x 1.2
    // is 74.4, so a 70 km/h gale goes unmentioned; at high sensitivity the bar
    // is 49.6 and it is raised.
    expect(kinds(gust(70), { sensitivity: "low" })).toEqual([]);
    expect(kinds(gust(70), { sensitivity: "medium" })).toEqual([
      "wind-gale-2026-09-05",
    ]);
    expect(kinds(gust(55), { sensitivity: "high" })).toEqual([
      "wind-gale-2026-09-05",
    ]);
  });
});

describe("deriveAlerts — precipitation", () => {
  const rate = (mm: number) => forecast({ hourly: { precipitation: [0, mm, 0] } });

  it("raises heavy rain at the AMS rate and not below", () => {
    expect(kinds(rate(7.5))).toEqual([]);
    expect(kinds(rate(7.6))).toEqual(["rain-heavy-2026-09-05"]);
  });

  it("escalates to torrential at the violent-rain rate", () => {
    expect(kinds(rate(49.9))).toEqual(["rain-heavy-2026-09-05"]);
    expect(kinds(rate(50))).toEqual(["rain-violent-2026-09-05"]);
  });

  it("uses the peak hourly rate, not the daily total", () => {
    // 30 mm across a day is a wet day; 30 mm in one hour is a flash flood.
    // Summing the series would rate the first as worse than the second.
    const spread = Array.from({ length: 24 }, () => 2);

    expect(kinds(forecast({ hourly: { precipitation: spread } }))).toEqual([]);
    expect(kinds(rate(30))).toEqual(["rain-heavy-2026-09-05"]);
  });
});

describe("deriveAlerts — temperature", () => {
  it("raises high heat at 35 °C and extreme at 40 °C", () => {
    expect(kinds(forecast({ daily: { temperature_2m_max: [34.9] } }))).toEqual([]);
    expect(kinds(forecast({ daily: { temperature_2m_max: [35] } }))).toEqual([
      "heat-high-2026-09-05",
    ]);
    expect(kinds(forecast({ daily: { temperature_2m_max: [40] } }))).toEqual([
      "heat-extreme-2026-09-05",
    ]);
  });

  it("raises severe cold at -10 °C and extreme at -20 °C", () => {
    expect(kinds(forecast({ daily: { temperature_2m_min: [-9.9] } }))).toEqual([]);
    expect(kinds(forecast({ daily: { temperature_2m_min: [-10] } }))).toEqual([
      "cold-high-2026-09-05",
    ]);
    expect(kinds(forecast({ daily: { temperature_2m_min: [-20] } }))).toEqual([
      "cold-extreme-2026-09-05",
    ]);
  });

  it("shifts temperature by an offset, not a multiplier", () => {
    // A multiplier on a temperature is meaningless: it depends on where the
    // scale's zero sits, so it would move 35 °C by 7 degrees and -10 °C by 2,
    // and do nothing at all near freezing. Both edges move by 3 °C here.
    expect(
      kinds(forecast({ daily: { temperature_2m_max: [32] } }), {
        sensitivity: "high",
      }),
    ).toEqual(["heat-high-2026-09-05"]);
    expect(
      kinds(forecast({ daily: { temperature_2m_max: [36] } }), {
        sensitivity: "low",
      }),
    ).toEqual([]);

    expect(
      kinds(forecast({ daily: { temperature_2m_min: [-7] } }), {
        sensitivity: "high",
      }),
    ).toEqual(["cold-high-2026-09-05"]);
    expect(
      kinds(forecast({ daily: { temperature_2m_min: [-11] } }), {
        sensitivity: "low",
      }),
    ).toEqual([]);
  });
});

describe("deriveAlerts — UV", () => {
  it("raises very high UV at the WHO edge of 8 and extreme at 11", () => {
    expect(kinds(forecast({ daily: { uv_index_max: [7.9] } }))).toEqual([]);
    expect(kinds(forecast({ daily: { uv_index_max: [8] } }))).toEqual([
      "uv-very-high-2026-09-05",
    ]);
    expect(kinds(forecast({ daily: { uv_index_max: [11] } }))).toEqual([
      "uv-extreme-2026-09-05",
    ]);
  });
});

describe("deriveAlerts — alert shape", () => {
  it("keys ids to the forecast day, so a refetch does not duplicate them", () => {
    // Stability is the whole requirement: an id containing a timestamp would
    // produce a fresh alert every refetch, defeating dismissal and read state.
    const source = forecast({ daily: { temperature_2m_max: [41] } });

    const first = deriveAlerts(source, { now: new Date("2026-09-05T09:00:00Z") });
    const later = deriveAlerts(source, { now: new Date("2026-09-05T15:30:00Z") });

    expect(first[0].id).toBe(later[0].id);
  });

  it("carries both scales — the three-step type and the four-step level", () => {
    const alerts = deriveAlerts(
      forecast({ daily: { temperature_2m_max: [41], uv_index_max: [9] } }),
      { now: NOW },
    );

    const heat = alerts.find((a) => a.id.startsWith("heat-extreme"));
    expect(heat?.level).toBe("severe");
    expect(heat?.type).toBe("danger");
  });

  it("stamps the profile it was raised for", () => {
    const alerts = deriveAlerts(
      forecast({ daily: { temperature_2m_max: [41] } }),
      { now: NOW, profile: "marine" },
    );

    expect(alerts[0].profile).toBe("marine");
    expect(deriveAlerts(forecast({ daily: { temperature_2m_max: [41] } }), { now: NOW })[0].profile).toBe(
      "general",
    );
  });

  it("records the reading and the threshold that fired", () => {
    const alerts = deriveAlerts(
      forecast({ hourly: { wind_speed_10m: [95] } }),
      { now: NOW },
    );

    expect(alerts[0].conditions).toMatchObject({
      peakWindKmh: 95,
      thresholdKmh: 89,
    });
  });

  it("raises every breach, not just the first", () => {
    const alerts = deriveAlerts(
      forecast({
        hourly: { weather_code: [96], wind_speed_10m: [95], precipitation: [60] },
        daily: { temperature_2m_max: [41], uv_index_max: [12] },
      }),
      { now: NOW },
    );

    expect(alerts.map((a) => a.id).sort()).toEqual([
      "heat-extreme-2026-09-05",
      "rain-violent-2026-09-05",
      "thunderstorm-hail-2026-09-05",
      "uv-extreme-2026-09-05",
      "wind-storm-2026-09-05",
    ]);
  });
});

describe("alertLevel", () => {
  const stored = (fields: Partial<WeatherAlert>): WeatherAlert => ({
    id: "a",
    type: "warning",
    profile: "general",
    title: "t",
    message: "m",
    timestamp: "2026-09-05T09:00:00.000Z",
    conditions: {},
    ...fields,
  });

  it("uses the carried level when there is one", () => {
    const derived = deriveAlerts(
      forecast({ daily: { temperature_2m_max: [41] } }),
      { now: NOW },
    )[0];

    expect(alertLevel(derived)).toBe("severe");
  });

  it("falls back to the three-step type for an alert without one", () => {
    expect(alertLevel(stored({ type: "info" }))).toBe("low");
    expect(alertLevel(stored({ type: "warning" }))).toBe("moderate");
    expect(alertLevel(stored({ type: "danger" }))).toBe("high");
  });

  it("never invents severe from the fallback", () => {
    // Three members cannot recover four. Reading a bare "danger" as "high"
    // under-states a severe alert, which is the cautious direction; promoting
    // it would claim a severity nothing measured.
    for (const type of ["info", "warning", "danger"] as const) {
      expect(alertLevel(stored({ type }))).not.toBe("severe");
    }
  });

  it("ignores a level that is not on the scale", () => {
    expect(
      alertLevel({ ...stored({ type: "danger" }), level: "medium" } as WeatherAlert),
    ).toBe("high");
  });
});
