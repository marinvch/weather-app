import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppTheme from "@/shared/theme/AppTheme";
import { SectionErrorBoundary } from "./SectionErrorBoundary";

function renderThemed(ui: ReactElement) {
  return render(<AppTheme>{ui}</AppTheme>);
}

/** Throws while `shouldThrow.current` is true — flipped by the test to model a
 * render error that a retry can get past (a transient bad payload). */
const shouldThrow = { current: true };
function Flaky() {
  if (shouldThrow.current) throw new Error("bad payload");
  return <p>recovered</p>;
}

describe("SectionErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow.current = true;
    // React logs every caught render error to console.error. Silenced so the
    // expected failures here do not read as real ones in the test output.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders its children when nothing throws", () => {
    renderThemed(
      <SectionErrorBoundary section="Weather map">
        <p>map</p>
      </SectionErrorBoundary>,
    );
    expect(screen.getByText("map")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("contains a crash to its own section and names it", () => {
    // The whole point: one broken panel must not blank the page.
    renderThemed(
      <>
        <SectionErrorBoundary section="Weather map">
          <Flaky />
        </SectionErrorBoundary>
        <p>the rest of the page</p>
      </>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Weather map could not be shown");
    expect(screen.getByText("the rest of the page")).toBeInTheDocument();
  });

  it("recovers on Retry once the cause has gone", async () => {
    const user = userEvent.setup();
    renderThemed(
      <SectionErrorBoundary section="Air quality">
        <Flaky />
      </SectionErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow.current = false;
    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(screen.getByText("recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resets by itself when a reset key changes", () => {
    // Picking another place or profile is a fresh start — the error from the
    // previous coordinate must not stick to the new one.
    const { rerender } = renderThemed(
      <SectionErrorBoundary section="Dashboard" resetKeys={["42.70,27.27"]}>
        <Flaky />
      </SectionErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    shouldThrow.current = false;
    rerender(
      <AppTheme>
        <SectionErrorBoundary section="Dashboard" resetKeys={["43.20,27.91"]}>
          <Flaky />
        </SectionErrorBoundary>
      </AppTheme>,
    );

    expect(screen.getByText("recovered")).toBeInTheDocument();
  });

  it("stays in the error state while the reset keys are unchanged", () => {
    const { rerender } = renderThemed(
      <SectionErrorBoundary section="Dashboard" resetKeys={["a"]}>
        <Flaky />
      </SectionErrorBoundary>,
    );
    shouldThrow.current = false;
    rerender(
      <AppTheme>
        <SectionErrorBoundary section="Dashboard" resetKeys={["a"]}>
          <Flaky />
        </SectionErrorBoundary>
      </AppTheme>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
