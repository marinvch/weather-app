import type { ReactNode } from "react";
import { StyledEngineProvider, ThemeProvider } from "@mui/material/styles";
import theme from "./theme";

/**
 * Wraps the app in the MUI theme, alongside the existing Tailwind + shadcn
 * styling rather than replacing it.
 *
 * Two deliberate choices, both about coexistence:
 *
 * 1. `injectFirst` puts MUI's <style> tags ahead of Tailwind's in <head>. MUI
 *    component styles and Tailwind utilities are both single-class selectors,
 *    so the cascade decides on source order — this is what lets a `className`
 *    on a MUI component actually win.
 *
 * 2. No <CssBaseline />. MUI's docs say to swap Tailwind's preflight for it,
 *    and that is correct once the Tailwind/shadcn layer is gone. Doing it now
 *    would break this app: Tailwind's `border` utilities set only border-width
 *    and rely on preflight for `border-style: solid`, and this UI is built on
 *    `border`, `border-2` and `border-b-2` throughout. Dropping preflight
 *    erases those borders silently.
 *
 * When the shadcn components are gone, flip both: drop `injectFirst`, add
 * <CssBaseline />, and set `corePlugins.preflight: false` in tailwind.config.js
 * in the same commit — they only work as a set.
 */
export function AppTheme({ children }: { children: ReactNode }) {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </StyledEngineProvider>
  );
}

export default AppTheme;
