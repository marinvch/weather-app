import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeatherCard } from "./WeatherCard";
import type { CurrentWeather, UserProfile } from "../../types/weather";

/**
 * WeatherCard is the only place unit conversion happens — Open-Meteo is always
 * queried in metric — so these assertions guard the numbers a user actually
 * reads, not just that the component renders.
 */
const baseWeather: CurrentWeather = {
  time: "2026-08-30T12:00",
  temperature_2m: 20,
  relative_humidity_2m: 55,
  wind_speed_10m: 10,
  wind_direction_10m: 0,
  weather_code: 0,
  is_day: 1,
};

function renderCard(
  overrides: Partial<CurrentWeather> = {},
  profile: UserProfile = "general",
  units: "metric" | "imperial" = "metric",
) {
  return render(
    <WeatherCard
      weather={{ ...baseWeather, ...overrides }}
      location="Burgas, Bulgaria"
      profile={profile}
      units={units}
    />,
  );
}

describe("WeatherCard — units", () => {
  it("shows metric values unchanged", () => {
    renderCard({ temperature_2m: 21.4, wind_speed_10m: 12.6 });

    expect(screen.getByText("21°C")).toBeInTheDocument();
    expect(screen.getByText("13 km/h")).toBeInTheDocument();
  });

  it("converts temperature to Fahrenheit for imperial", () => {
    renderCard({ temperature_2m: 20 }, "general", "imperial");

    expect(screen.getByText("68°F")).toBeInTheDocument();
  });

  it("converts freezing point correctly", () => {
    renderCard({ temperature_2m: 0 }, "general", "imperial");

    expect(screen.getByText("32°F")).toBeInTheDocument();
  });

  it("handles negative temperatures", () => {
    renderCard({ temperature_2m: -10 }, "general", "imperial");

    expect(screen.getByText("14°F")).toBeInTheDocument();
  });

  it("converts wind speed from km/h to mph", () => {
    renderCard({ wind_speed_10m: 100 }, "general", "imperial");

    // 100 km/h * 0.621371 = 62.1 -> 62 mph
    expect(screen.getByText("62 mph")).toBeInTheDocument();
  });
});

describe("WeatherCard — weather codes", () => {
  it("renders the description and emoji for a known code", () => {
    renderCard({ weather_code: 95 });

    expect(screen.getByText("Thunderstorm")).toBeInTheDocument();
    expect(screen.getByText("⛈️")).toBeInTheDocument();
  });

  it("falls back to Unknown for a code missing from the lookup", () => {
    // 4 is not in weatherCodes; the card must not render "undefined".
    renderCard({ weather_code: 4 });

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("❓")).toBeInTheDocument();
  });
});

describe("WeatherCard — wind direction", () => {
  it.each([
    [0, "N"],
    [90, "E"],
    [180, "S"],
    [270, "W"],
    [45, "NE"],
    [350, "N"],
  ])("renders %i° as %s", (degrees, expected) => {
    // Only the marine and mountain layouts show the compass label.
    renderCard({ wind_direction_10m: degrees }, "marine");

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe("WeatherCard — per-profile layout", () => {
  it("shows wind direction and humidity for marine", () => {
    renderCard({}, "marine");

    expect(screen.getByText("Humidity")).toBeInTheDocument();
    expect(screen.getByText("N")).toBeInTheDocument();
  });

  it("shows a day/night visibility field for mountain", () => {
    renderCard({ is_day: 0 }, "mountain");

    expect(screen.getByText("Visibility")).toBeInTheDocument();
    expect(screen.getByText("Night")).toBeInTheDocument();
  });

  it("shows humidity and wind, but no compass label, for general", () => {
    renderCard({ wind_direction_10m: 90 }, "general");

    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(screen.queryByText("E")).not.toBeInTheDocument();
  });

  it("always shows the location name", () => {
    renderCard();

    expect(screen.getByText("Burgas, Bulgaria")).toBeInTheDocument();
  });
});
