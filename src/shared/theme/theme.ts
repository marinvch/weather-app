import { createTheme } from "@mui/material/styles";

/**
 * The MUI theme for Weather Pro.
 *
 * Deliberately NOT using `modularCssLayers`. That is the right answer against
 * Tailwind v4, which emits its own cascade layers — but this repo is on
 * Tailwind v3, whose output is unlayered, and unlayered CSS beats every layer
 * regardless of specificity. Putting MUI in `@layer mui` here would let
 * Tailwind's preflight element resets override MUI's own component styles.
 *
 * See src/theme/AppTheme.tsx for the injection-order half of this.
 */
export const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: true,
    dark: true,
  },
  palette: {
    primary: {
      // Matches the PWA theme-color in index.html and manifest.json, so the
      // browser chrome and the app agree.
      main: "#0ea5e9",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: [
      "system-ui",
      "-apple-system",
      "Segoe UI",
      "Roboto",
      "Helvetica Arial",
      "sans-serif",
    ].join(","),
  },
});

export default theme;
