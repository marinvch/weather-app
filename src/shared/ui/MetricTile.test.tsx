import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppTheme from "@/shared/theme/AppTheme";
import { MetricTile } from "./MetricTile";

function renderTile(ui: ReactElement) {
  return render(<AppTheme>{ui}</AppTheme>);
}

describe("MetricTile", () => {
  it("renders the label, the figure and the unit as separate text", () => {
    renderTile(<MetricTile label="Wind" value="18" unit="km/h" />);

    expect(screen.getByText("Wind")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    // Separate, not "18 km/h": a column of tiles only aligns if the unit is
    // its own element.
    expect(screen.getByText("km/h")).toBeInTheDocument();
  });

  it("renders a hint when one is given, and nothing when it is not", () => {
    const { unmount } = renderTile(
      <MetricTile label="Soil moisture" value="14" unit="%" hint="Below 20% — irrigate" />,
    );
    expect(screen.getByText("Below 20% — irrigate")).toBeInTheDocument();
    unmount();

    renderTile(<MetricTile label="Soil moisture" value="14" unit="%" />);
    expect(screen.queryByText(/irrigate/)).not.toBeInTheDocument();
  });

  it("puts the severity into the accessible name, not only into the colour", () => {
    // The point of the assertion: a tinted background is invisible to a
    // colour-blind reader and to a screen reader alike, so the level has to be
    // in the text layer too.
    renderTile(<MetricTile label="Wave height" value="4.2" unit="m" severity={3} />);

    const tile = screen.getByRole("group");
    expect(tile).toHaveAccessibleName(/severe risk/i);
    expect(tile).toHaveAccessibleName(/wave height/i);
    expect(tile).toHaveAccessibleName(/4\.2/);
  });

  it("says nothing about risk at severity 0", () => {
    renderTile(<MetricTile label="Humidity" value="55" unit="%" />);
    expect(screen.getByRole("group")).not.toHaveAccessibleName(/risk/i);
  });

  it("names each severity step with its own word", () => {
    const words = ["low", "moderate", "high", "severe"] as const;
    ([1, 2, 3] as const).forEach((severity) => {
      const { unmount } = renderTile(
        <MetricTile label="Gust" value="60" severity={severity} />,
      );
      expect(screen.getByRole("group")).toHaveAccessibleName(
        new RegExp(`${words[severity]} risk`, "i"),
      );
      unmount();
    });
  });

  it("announces a trend in words as well as an arrow", () => {
    renderTile(<MetricTile label="Pressure" value="1004" unit="hPa" trend="down" />);
    expect(screen.getByRole("group")).toHaveAccessibleName(/falling/i);
  });

  it("accepts a node as the value without breaking the accessible name", () => {
    renderTile(<MetricTile label="Sunrise" value={<span>06:41</span>} />);
    expect(screen.getByText("06:41")).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveAccessibleName(/sunrise/i);
  });
});
