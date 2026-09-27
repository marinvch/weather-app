import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppTheme from "@/shared/theme/AppTheme";
import { DashboardShell } from "./DashboardShell";

function renderShell(ui: ReactElement) {
  return render(<AppTheme>{ui}</AppTheme>);
}

const base = {
  title: "Marine conditions",
  locationName: "Burgas Bay",
  coordinates: { latitude: 42.4619, longitude: 27.4039 },
  isLoading: false,
  isError: false,
};

describe("DashboardShell", () => {
  it("shows the header in every state, including the failed one", () => {
    // A dashboard that loses its own title on failure leaves the reader with
    // no idea which of four panels broke.
    const { unmount } = renderShell(
      <DashboardShell {...base} isLoading>
        <p>ready</p>
      </DashboardShell>,
    );
    expect(
      screen.getByRole("heading", { name: "Marine conditions" }),
    ).toBeInTheDocument();
    unmount();

    renderShell(
      <DashboardShell {...base} isError>
        <p>ready</p>
      </DashboardShell>,
    );
    expect(
      screen.getByRole("heading", { name: "Marine conditions" }),
    ).toBeInTheDocument();
  });

  it("shows the location name and its WGS 84 coordinates, unconverted", () => {
    renderShell(
      <DashboardShell {...base} subtitle="Waves and sea state">
        <p>ready</p>
      </DashboardShell>,
    );
    expect(screen.getByText("Waves and sea state")).toBeInTheDocument();
    // Four decimals, latitude first — WGS84.precision, straight from
    // formatCoordinates. Nothing on this screen projects anything.
    expect(screen.getByText("42.4619, 27.4039")).toBeInTheDocument();
  });

  it("renders skeletons and withholds the children while loading", () => {
    const { container } = renderShell(
      <DashboardShell {...base} isLoading>
        <p>ready</p>
      </DashboardShell>,
    );

    expect(screen.queryByText("ready")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(
      1,
    );
    // A spinner is not a skeleton: the point is that the boxes hold the space
    // the content will take, so nothing reflows when it lands.
    expect(container.querySelector(".MuiCircularProgress-root")).toBeNull();
  });

  it("marks itself busy while loading so the outcome is announced once", () => {
    const { container } = renderShell(
      <DashboardShell {...base} isLoading>
        <p>ready</p>
      </DashboardShell>,
    );
    expect(container.querySelector('[aria-live="polite"]')).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("explains the failure and offers a retry that fires", async () => {
    const onRetry = vi.fn();
    renderShell(
      <DashboardShell
        {...base}
        isError
        error={{ status: "FETCH_ERROR", error: "TypeError" }}
        onRetry={onRetry}
      >
        <p>ready</p>
      </DashboardShell>,
    );

    expect(screen.queryByText("ready")).not.toBeInTheDocument();
    expect(screen.getByText(/could not reach the weather service/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry button when there is nothing to retry with", () => {
    renderShell(
      <DashboardShell {...base} isError>
        <p>ready</p>
      </DashboardShell>,
    );
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("keeps empty separate from failed, and says what is missing", () => {
    // The mountain dashboard used to fold these together, so a partial payload
    // told the reader the request had failed.
    renderShell(
      <DashboardShell {...base} isEmpty>
        <p>ready</p>
      </DashboardShell>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/the request succeeded/i);
    expect(alert).toHaveTextContent("42.4619, 27.4039");
    expect(alert).not.toHaveTextContent(/went wrong/i);
    expect(screen.queryByText("ready")).not.toBeInTheDocument();
  });

  it("prefers the error state when a failed request also looks empty", () => {
    renderShell(
      <DashboardShell {...base} isError isEmpty>
        <p>ready</p>
      </DashboardShell>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByText(/the request succeeded/i)).not.toBeInTheDocument();
  });

  it("renders its children once the data is there", () => {
    renderShell(
      <DashboardShell {...base} actions={<button type="button">Refresh</button>}>
        <p>ready</p>
      </DashboardShell>,
    );
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
