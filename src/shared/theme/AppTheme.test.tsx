import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Button from "@mui/material/Button";
import { useTheme } from "@mui/material/styles";
import AppTheme from "./AppTheme";
import theme from "./theme";

/**
 * A smoke test for the MUI wiring. It is not testing MUI — it is testing that
 * OUR provider actually reaches components, because the failure mode is silent:
 * a MUI component outside the ThemeProvider renders with the default theme and
 * looks almost right.
 */
function ThemeProbe() {
  const active = useTheme();
  return (
    <>
      <span data-testid="primary">{active.palette.primary.main}</span>
      <span data-testid="radius">{String(active.shape.borderRadius)}</span>
    </>
  );
}

describe("AppTheme", () => {
  it("renders MUI components with our theme, not MUI's default", () => {
    render(
      <AppTheme>
        <ThemeProbe />
      </AppTheme>,
    );

    expect(screen.getByTestId("primary")).toHaveTextContent("#0ea5e9");
    expect(screen.getByTestId("radius")).toHaveTextContent("8");
  });

  it("keeps the palette in step with the PWA theme-color", () => {
    // index.html and public/manifest.json both declare #0ea5e9. If the theme
    // drifts from them the browser chrome stops matching the app.
    expect(theme.palette.primary.main).toBe("#0ea5e9");
  });

  it("renders a MUI component and lets a className through", () => {
    render(
      <AppTheme>
        <Button className="custom-tailwind-class">Refresh</Button>
      </AppTheme>,
    );

    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).toBeInTheDocument();
    // MUI must not swallow the className — that is what makes Tailwind
    // utilities usable on MUI components during the migration.
    expect(button).toHaveClass("custom-tailwind-class");
    expect(button.className).toContain("MuiButton");
  });

  it("exposes CSS variables, which is what lets Tailwind read MUI's palette", () => {
    // cssVariables: true is the bridge between the two styling systems — a
    // Tailwind class can reference var(--mui-palette-primary-main). Without it
    // the palette is only reachable from inside MUI's own styling engine.
    expect(theme.vars).toBeDefined();
    expect(theme.vars?.palette.primary.main).toContain("--mui-palette-primary");
  });
});
