import type { ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./theme";

/**
 * Wraps the app in the MUI theme.
 *
 * Tailwind and shadcn are gone, so the three coexistence settings that used to
 * live here have been flipped together, as a set:
 *
 * - `StyledEngineProvider injectFirst` removed. It existed so Tailwind
 *   utilities could win over MUI on equal specificity. With no Tailwind, it
 *   only made MUI's own styles harder to override.
 * - `<CssBaseline />` added. It is the reset now that Tailwind's preflight is
 *   gone — without one, the browser's default margins come back.
 * - `corePlugins.preflight` is moot; tailwind.config.js no longer exists.
 *
 * `modularCssLayers` stays off. It was wrong against Tailwind v3's unlayered
 * output, and with nothing to interop with it now buys nothing.
 */
export function AppTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export default AppTheme;
