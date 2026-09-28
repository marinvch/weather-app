import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppTheme from "@/shared/theme/AppTheme";
import { HeroConditions } from "./HeroConditions";

function renderHero(ui: ReactElement) {
  return render(<AppTheme>{ui}</AppTheme>);
}

const base = {
  locationName: "Medenrudnik, Burgas",
  temperature: 21.4,
  weatherCode: 3,
  isDay: true,
  temperatureUnit: "c",
} as const;

describe("HeroConditions", () => {
  it("renders the location, the reading and the condition label", () => {
    renderHero(<HeroConditions {...base} />);

    expect(screen.getByText("Medenrudnik, Burgas")).toBeInTheDocument();
    expect(screen.getByText(/21/)).toBeInTheDocument();
    expect(screen.getByText("Overcast")).toBeInTheDocument();
  });

  it("converts the Celsius input for an imperial reader", () => {
    // The prop is always Celsius. 21.4 C is 70.5 F, which rounds to 71.
    renderHero(<HeroConditions {...base} temperatureUnit="f" />);
    expect(screen.getByText(/71/)).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
  });

  it("shows feels-like and the daily range when they are supplied", () => {
    renderHero(
      <HeroConditions {...base} apparentTemperature={19.2} high={24} low={13} />,
    );
    expect(screen.getByText("Feels like 19°")).toBeInTheDocument();
    expect(screen.getByText(/H 24/)).toBeInTheDocument();
    expect(screen.getByText(/L 13/)).toBeInTheDocument();
  });

  it("omits feels-like rather than printing NaN when it is missing", () => {
    renderHero(<HeroConditions {...base} apparentTemperature={Number.NaN} />);
    expect(screen.queryByText(/Feels like/)).not.toBeInTheDocument();
  });

  it("ignores an unparseable timestamp instead of rendering Invalid Date", () => {
    renderHero(<HeroConditions {...base} observedAt="not a date" />);
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it("reads an unknown weather code through the table's fallback", () => {
    renderHero(<HeroConditions {...base} weatherCode={4} />);
    expect(screen.getByText("Unknown conditions")).toBeInTheDocument();
  });

  it("paints a different sky by day and by night for the same code", () => {
    // Emotion hashes the resolved styles into the class name, so two different
    // gradients mean two different classes. A day and a night hero that hashed
    // identically would mean `isDay` never reached `skyGradient`.
    const { container: day } = renderHero(<HeroConditions {...base} />);
    const { container: night } = renderHero(
      <HeroConditions {...base} isDay={false} />,
    );

    expect(day.firstElementChild?.className).not.toBe(
      night.firstElementChild?.className,
    );
    expect(screen.getAllByText("Overcast")).toHaveLength(2);
  });

  it("renders the secondary readout row it is handed", () => {
    renderHero(
      <HeroConditions
        {...base}
        secondary={<span data-testid="secondary">18 km/h NNE</span>}
      />,
    );
    expect(screen.getByTestId("secondary")).toHaveTextContent("18 km/h NNE");
  });
});
