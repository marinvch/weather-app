import { describe, it, expect } from "vitest";
import {
  daylightForDay,
  daylightProgress,
  formatDuration,
  formatLocalTime,
  localMinutesNow,
  minutesIntoDay,
} from "./astronomy";
import type { DailyWeatherWithAstronomy } from "@/shared/types/weather";

function daily(
  fields: Partial<DailyWeatherWithAstronomy> = {},
): DailyWeatherWithAstronomy {
  return {
    time: ["2026-09-05"],
    temperature_2m_max: [28],
    temperature_2m_min: [17],
    precipitation_sum: [0],
    wind_speed_10m_max: [12],
    weather_code: [0],
    sunrise: ["2026-09-05T06:42"],
    sunset: ["2026-09-05T19:54"],
    daylight_duration: [47520],
    sunshine_duration: [41000],
    uv_index_max: [7.2],
    ...fields,
  };
}

describe("formatLocalTime", () => {
  it("renders the wall-clock time the API sent, not the viewer's", () => {
    // Open-Meteo sends local time with no offset. `new Date(iso)` would apply
    // the *browser's* offset to a time that is already local to somewhere
    // else, so a Tokyo sunrise viewed from Sofia would read six hours out —
    // and still look like a perfectly ordinary time.
    expect(formatLocalTime("2026-09-05T06:42", "en-GB")).toBe("06:42");
    expect(formatLocalTime("2026-09-05T19:54", "en-GB")).toBe("19:54");
  });

  it("respects the locale's clock convention", () => {
    expect(formatLocalTime("2026-09-05T19:54", "en-US")).toMatch(/PM/i);
  });

  it("handles midnight and the last minute of the day", () => {
    expect(formatLocalTime("2026-09-05T00:00", "en-GB")).toBe("00:00");
    expect(formatLocalTime("2026-09-05T23:59", "en-GB")).toBe("23:59");
  });

  it("returns a placeholder for anything that is not a timestamp", () => {
    expect(formatLocalTime("")).toBe("--:--");
    expect(formatLocalTime("not a time")).toBe("--:--");
    expect(formatLocalTime("2026-09-05T25:00")).toBe("--:--");
  });
});

describe("minutesIntoDay", () => {
  it("counts from local midnight", () => {
    expect(minutesIntoDay("2026-09-05T00:00")).toBe(0);
    expect(minutesIntoDay("2026-09-05T06:42")).toBe(402);
    expect(minutesIntoDay("2026-09-05T23:59")).toBe(1439);
  });

  it("is null for a malformed timestamp", () => {
    expect(minutesIntoDay("nope")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("takes seconds, the unit Open-Meteo sends", () => {
    // 47520 s is 13 h 12 min. Anything that reads this as minutes or hours
    // produces a plausible figure rather than an error, which is the whole
    // reason this is tested at the boundary rather than eyeballed on screen.
    expect(formatDuration(47520)).toBe("13 h 12 min");
    expect(formatDuration(3600)).toBe("1 h 0 min");
    expect(formatDuration(86400)).toBe("24 h 0 min");
  });

  it("drops the hours when there are none", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(1800)).toBe("30 min");
  });

  it("rounds to the nearest minute", () => {
    expect(formatDuration(89)).toBe("1 min");
    expect(formatDuration(91)).toBe("2 min");
  });

  it("returns a placeholder for a missing or impossible duration", () => {
    expect(formatDuration(Number.NaN)).toBe("--");
    expect(formatDuration(-10)).toBe("--");
  });
});

describe("daylightForDay", () => {
  it("reads one day out of the daily block", () => {
    const day = daylightForDay(daily());

    expect(day).not.toBeNull();
    expect(day!.date).toBe("2026-09-05");
    expect(day!.sunrise).toMatch(/6|06/);
    expect(day!.daylightSeconds).toBe(47520);
    expect(day!.sunshineSeconds).toBe(41000);
    expect(day!.uvIndexMax).toBe(7.2);
  });

  it("computes sunshine as a fraction of daylight", () => {
    expect(daylightForDay(daily())!.sunshineFraction).toBeCloseTo(
      41000 / 47520,
    );
  });

  it("clamps the fraction at 1 rather than overflowing a bar", () => {
    // Daylight and sunshine are modelled separately, so rounding at the edges
    // of a polar day can put sunshine a hair above daylight.
    const day = daylightForDay(
      daily({ daylight_duration: [40000], sunshine_duration: [40100] }),
    );

    expect(day!.sunshineFraction).toBe(1);
  });

  it("reports null rather than zero for a variable that was not requested", () => {
    // Null means "not supplied" and renders as nothing. Zero would claim a day
    // with no sunshine at all, which is a different and wrong statement.
    const day = daylightForDay(
      daily({
        daylight_duration: undefined,
        sunshine_duration: undefined,
        uv_index_max: undefined,
      }),
    );

    expect(day!.daylightSeconds).toBeNull();
    expect(day!.sunshineSeconds).toBeNull();
    expect(day!.sunshineFraction).toBeNull();
    expect(day!.uvIndexMax).toBeNull();
  });

  it("is null when the day is not in the payload at all", () => {
    expect(daylightForDay(undefined)).toBeNull();
    expect(daylightForDay(daily(), 5)).toBeNull();
  });

  it("reads a later day by index", () => {
    const week = daily({
      time: ["2026-09-05", "2026-09-06"],
      sunrise: ["2026-09-05T06:42", "2026-09-06T06:43"],
      sunset: ["2026-09-05T19:54", "2026-09-06T19:52"],
      daylight_duration: [47520, 47340],
      sunshine_duration: [41000, 12000],
      uv_index_max: [7.2, 3.1],
    });

    expect(daylightForDay(week, 1)!.date).toBe("2026-09-06");
    expect(daylightForDay(week, 1)!.uvIndexMax).toBe(3.1);
  });
});

describe("localMinutesNow", () => {
  // 2026-09-05T10:30:00Z, fixed so the assertions are about the offset
  // arithmetic and not about when the suite happens to run.
  const utcInstant = new Date(Date.UTC(2026, 8, 5, 10, 30));

  it("applies the coordinate's offset, not the viewer's", () => {
    expect(localMinutesNow(0, utcInstant)).toBe(10 * 60 + 30);
    // Sofia, UTC+3 in September.
    expect(localMinutesNow(3 * 3600, utcInstant)).toBe(13 * 60 + 30);
    // New York, UTC-4.
    expect(localMinutesNow(-4 * 3600, utcInstant)).toBe(6 * 60 + 30);
  });

  it("wraps rather than going negative across midnight", () => {
    // 00:30 UTC in Los Angeles (UTC-7) is 17:30 the previous day. A raw
    // modulo gives a negative minute count here, which reads as "before
    // sunrise" for the whole afternoon.
    const justAfterUtcMidnight = new Date(Date.UTC(2026, 8, 5, 0, 30));

    expect(localMinutesNow(-7 * 3600, justAfterUtcMidnight)).toBe(17 * 60 + 30);
  });

  it("wraps forward past midnight too", () => {
    // 23:30 UTC in Tokyo (UTC+9) is 08:30 the next day.
    const lateUtc = new Date(Date.UTC(2026, 8, 5, 23, 30));

    expect(localMinutesNow(9 * 3600, lateUtc)).toBe(8 * 60 + 30);
  });

  it("falls back to UTC when the offset is missing", () => {
    expect(localMinutesNow(Number.NaN, utcInstant)).toBe(10 * 60 + 30);
  });
});

describe("daylightProgress", () => {
  const sunrise = "2026-09-05T06:00";
  const sunset = "2026-09-05T18:00";

  it("is 0 at sunrise, 0.5 at midday and 1 at sunset", () => {
    expect(daylightProgress(6 * 60, sunrise, sunset)).toBe(0);
    expect(daylightProgress(12 * 60, sunrise, sunset)).toBe(0.5);
    expect(daylightProgress(18 * 60, sunrise, sunset)).toBe(1);
  });

  it("clamps outside daylight rather than running off the strip", () => {
    expect(daylightProgress(3 * 60, sunrise, sunset)).toBe(0);
    expect(daylightProgress(23 * 60, sunrise, sunset)).toBe(1);
  });

  it("is null when the times are missing or nonsensical", () => {
    expect(daylightProgress(600, "", sunset)).toBeNull();
    expect(daylightProgress(600, sunrise, "")).toBeNull();
    // Polar night: sunset at or before sunrise leaves nothing to divide by.
    expect(daylightProgress(600, sunset, sunrise)).toBeNull();
  });
});
