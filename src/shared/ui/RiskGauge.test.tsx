import type { ReactElement } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppTheme from "@/shared/theme/AppTheme";
import { RiskGauge } from "./RiskGauge";

function renderGauge(ui: ReactElement) {
  return render(<AppTheme>{ui}</AppTheme>);
}

describe("RiskGauge", () => {
  it("names each level in words", () => {
    const cases = [
      ["low", "Low risk"],
      ["moderate", "Moderate risk"],
      ["high", "High risk"],
      ["severe", "Severe risk"],
    ] as const;

    cases.forEach(([level, heading]) => {
      const { unmount } = renderGauge(<RiskGauge level={level} />);
      expect(screen.getByText(heading)).toBeInTheDocument();
      unmount();
    });
  });

  it("communicates the level without colour, as a step out of four", () => {
    // The reason this component is not a coloured Chip: the segment count is
    // the channel that survives greyscale, sunlight and colour blindness.
    renderGauge(<RiskGauge level="high" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "High risk: step 3 of 4",
    );
  });

  it("lights one more segment per step", () => {
    const expected = [1, 2, 3, 4];
    (["low", "moderate", "high", "severe"] as const).forEach((level, index) => {
      const { unmount } = renderGauge(<RiskGauge level={level} />);
      expect(screen.getByRole("img")).toHaveAccessibleName(
        new RegExp(`step ${expected[index]} of 4`),
      );
      unmount();
    });
  });

  it("shows a score when the scorer produced one", () => {
    renderGauge(<RiskGauge level="moderate" score={62.4} />);
    expect(screen.getByText("score 62/100")).toBeInTheDocument();
  });

  it("omits the score rather than rendering NaN", () => {
    renderGauge(<RiskGauge level="moderate" score={Number.NaN} />);
    expect(screen.queryByText(/score/)).not.toBeInTheDocument();
  });

  it("shows a zero score, which is a real reading and not a missing one", () => {
    renderGauge(<RiskGauge level="low" score={0} />);
    expect(screen.getByText("score 0/100")).toBeInTheDocument();
  });

  it("takes an overriding label and a description", () => {
    renderGauge(
      <RiskGauge
        level="severe"
        label="Sea state"
        description="4.5 m swell on a 6 s period."
      />,
    );
    expect(screen.getByText("Sea state")).toBeInTheDocument();
    expect(screen.getByText("4.5 m swell on a 6 s period.")).toBeInTheDocument();
    // The override reaches the non-visual channel too, or the two disagree.
    expect(screen.getByRole("img")).toHaveAccessibleName("Sea state: step 4 of 4");
  });
});
