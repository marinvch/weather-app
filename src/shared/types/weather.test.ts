import { describe, it, expect } from "vitest";
import {
  RISK_LEVELS,
  riskLevelFromAnalysis,
  type AIAnalysis,
  type RiskLevel,
} from "./weather";

/**
 * `riskLevelFromAnalysis` is the one sanctioned crossing between the scorers'
 * three-step `riskLevel` and the four-step display scale the palette is keyed
 * on. The decision was to convert at the boundary rather than migrate
 * `AIAnalysis.riskLevel`, which makes this function load-bearing: a cast in its
 * place produces "medium", which matches no key in the `risk` palette and
 * renders undefined colours instead of failing.
 */
describe("riskLevelFromAnalysis", () => {
  it("passes low and high through unchanged", () => {
    expect(riskLevelFromAnalysis("low")).toBe("low");
    expect(riskLevelFromAnalysis("high")).toBe("high");
  });

  it("renames medium to moderate — the same band, the palette's name", () => {
    expect(riskLevelFromAnalysis("medium")).toBe("moderate");
  });

  it("maps every input the three-step scale can produce", () => {
    // Written out rather than derived, so adding a member to
    // AIAnalysis["riskLevel"] fails here instead of falling through silently.
    const inputs: AIAnalysis["riskLevel"][] = ["low", "medium", "high"];
    for (const input of inputs) {
      expect(RISK_LEVELS).toContain(riskLevelFromAnalysis(input));
    }
  });

  it("never returns medium, which is what the palette would choke on", () => {
    const inputs: AIAnalysis["riskLevel"][] = ["low", "medium", "high"];
    for (const input of inputs) {
      expect(riskLevelFromAnalysis(input)).not.toBe("medium");
    }
  });

  it("cannot reach severe from an Analysis", () => {
    // Nothing in the four scorers produces the fourth band today. The step
    // exists for the alert and flood surfaces, which do have one — so if this
    // ever fails, the scorers gained a level and the scale needs revisiting.
    const inputs: AIAnalysis["riskLevel"][] = ["low", "medium", "high"];
    expect(inputs.map(riskLevelFromAnalysis)).not.toContain("severe");
  });

  it("preserves the ordering of the scale it maps onto", () => {
    const ordered: RiskLevel[] = ["low", "medium", "high"].map((level) =>
      riskLevelFromAnalysis(level as AIAnalysis["riskLevel"]),
    );
    const indices = ordered.map((level) => RISK_LEVELS.indexOf(level));
    // A worse Analysis must never come out as a lower display step.
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(3);
  });
});

describe("RISK_LEVELS", () => {
  it("is ordered least to most severe, so the index is the severity", () => {
    // MetricTile's `severity: 0|1|2|3` indexes straight into this. Reordering
    // it silently re-tints every tile in the app.
    expect(RISK_LEVELS).toEqual(["low", "moderate", "high", "severe"]);
  });
});
