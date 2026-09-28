import { createTheme } from "@mui/material/styles";
import type { RiskLevel } from "@/shared/types/weather";

/**
 * The MUI theme for Weather Pro — the app's whole design system.
 *
 * The intent is a *precision instrument*: a dense, high-contrast readout where
 * numbers dominate and colour is spent only on meaning. Concretely that means
 * flat surfaces with a hairline border instead of drop shadows, tabular
 * numerals on every figure so a changing reading does not shuffle sideways, and
 * a palette in which saturated colour is reserved for risk.
 *
 * There is one styling engine. A style worth sharing belongs in `components`
 * below or in the palette, never copied between `sx` props — there is no
 * `className` utility layer left to fall back on.
 */

// ---------------------------------------------------------------------------
// Module augmentation
// ---------------------------------------------------------------------------

/** One step of the risk scale, in the four roles a severity needs. */
export interface RiskTone {
  /** The signal colour: an icon, a gauge fill, a border on a live alert. */
  main: string;
  /** Legible text on `main`. */
  contrastText: string;
  /** A tinted surface — a chip or tile background that text sits on. */
  soft: string;
  /** The hairline for a `soft` surface, since `main` is too loud at 1px. */
  border: string;
  /** Text on a `soft` surface. Not `main`: `main` fails contrast at 14px. */
  text: string;
}

declare module "@mui/material/styles" {
  /**
   * Tells TypeScript that the `cssVariables` option is on, which is what makes
   * `theme.vars` non-optional. Without it `vars` is `Partial<...>` and every
   * `styleOverrides` callback needs a non-null assertion. This is about the
   * *type*, so it is unaffected by `cssVariables` being an options object
   * rather than `true`.
   */
  interface CssThemeVariables {
    enabled: true;
  }

  /**
   * Risk severity, as a palette section rather than a lookup table in a
   * component — so `theme.vars.palette.risk.severe.main` resolves to a CSS
   * variable and re-tints itself across colour schemes with no re-render.
   *
   * Keyed by `RiskLevel`, so adding a step to the union is a compile error
   * here rather than an `undefined` background at runtime.
   */
  interface Palette {
    risk: Record<RiskLevel, RiskTone>;
  }
  interface PaletteOptions {
    risk?: Record<RiskLevel, RiskTone>;
  }

  interface TypographyVariants {
    /** The single dominant figure on a screen — the hero temperature. */
    readout: React.CSSProperties;
    /** A secondary figure: the number on a `MetricTile`. */
    metric: React.CSSProperties;
    /** The small-caps label above a figure. */
    label: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    readout?: React.CSSProperties;
    metric?: React.CSSProperties;
    label?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    readout: true;
    metric: true;
    label: true;
  }
}

// ---------------------------------------------------------------------------
// Foundations
// ---------------------------------------------------------------------------

const FONT_STACK = [
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Helvetica Arial",
  "sans-serif",
].join(",");

/**
 * Lining, fixed-width digits. Proportional digits make a live temperature jitter
 * horizontally as it ticks between 8 and 1, which reads as a layout bug.
 */
const TABULAR = {
  fontVariantNumeric: "tabular-nums lining-nums",
} as const;

const risk = {
  light: {
    low: {
      main: "#12805A",
      contrastText: "#FFFFFF",
      soft: "#E6F5EF",
      border: "#A6DCC7",
      text: "#0A5B40",
    },
    moderate: {
      main: "#B07100",
      contrastText: "#FFFFFF",
      soft: "#FBF2DF",
      border: "#E8CE8E",
      text: "#7D5000",
    },
    high: {
      main: "#C2410C",
      contrastText: "#FFFFFF",
      soft: "#FCEDE5",
      border: "#F0BC9E",
      text: "#8E2F08",
    },
    severe: {
      main: "#A31515",
      contrastText: "#FFFFFF",
      soft: "#FBE9E9",
      border: "#EAAEAE",
      text: "#7A1010",
    },
  },
  dark: {
    low: {
      main: "#3DD68C",
      contrastText: "#04150E",
      soft: "#0F2A20",
      border: "#1E5540",
      text: "#7DE7B4",
    },
    moderate: {
      main: "#F0B429",
      contrastText: "#1A1204",
      soft: "#2C2410",
      border: "#5C4A16",
      text: "#F7CF6B",
    },
    high: {
      main: "#FB8A3C",
      contrastText: "#1C0E04",
      soft: "#2E1C10",
      border: "#63391A",
      text: "#FDAF77",
    },
    severe: {
      main: "#F76A6A",
      contrastText: "#1C0606",
      soft: "#301414",
      border: "#672626",
      text: "#FB9E9E",
    },
  },
} satisfies Record<"light" | "dark", Record<RiskLevel, RiskTone>>;

export const theme = createTheme({
  /**
   * The selector is load-bearing, and `cssVariables: true` is the wrong value
   * here despite looking like the obvious one.
   *
   * With both `light` and `dark` given below, MUI defaults
   * `colorSchemeSelector` to `'media'` (`createThemeWithVars.js`: `selector =
   * colorSchemesInput.light && colorSchemesInput.dark ? 'media' : undefined`).
   * On `'media'` it emits `@media (prefers-color-scheme: dark)` and nothing
   * else, so the scheme follows the OS and only the OS —
   * `useColorScheme().setMode('dark')` updates MUI's internal state, writes no
   * selector to the DOM, and the colours never move.
   *
   * **It fails silently.** Nothing warns, and `useColorScheme()` reports back
   * the mode you asked for, so a three-way theme control looks like it works
   * right up until someone notices it does nothing. Naming a selector is what
   * makes a manual toggle possible at all.
   *
   * The data-attribute form rather than `'class'`: there is no class-based
   * styling left in the app for it to collide with.
   *
   * **The attribute name is a contract with `index.html`.** A selector-based
   * scheme is written by JS after the bundle loads, so a stored preference that
   * differs from the OS setting would flash the wrong colours on first paint.
   * The blocking inline script in `index.html` prevents that by stamping this
   * exact attribute on `<html>` before the app mounts, reading MUI's own
   * `mui-mode` / `mui-color-scheme-light` / `mui-color-scheme-dark` keys. So
   * renaming the attribute here silently reintroduces the flash — the app
   * still works, it just blinks. `AppTheme.test.tsx` pins the value; the same
   * standing agreement as `primary.main` and the PWA theme-color.
   */
  cssVariables: { colorSchemeSelector: "data-mui-color-scheme" },

  /**
   * v9's built-in ring, on every focusable MUI component at once. Opting in
   * here is the only way to get one consistent ring — done per component it
   * drifts, and `outline: none` anywhere is a keyboard trap.
   */
  focusVisible: {
    outlineWidth: 2,
    outlineOffset: 3,
  },

  colorSchemes: {
    light: {
      palette: {
        primary: {
          // Unchanged on purpose: index.html and public/manifest.json both
          // declare #0ea5e9 as the PWA theme-color, and AppTheme.test.tsx
          // asserts the three stay in step. Change one, change all three.
          main: "#0ea5e9",
          light: "#5EC8F5",
          dark: "#0A6E9E",
          // Explicit, because #0ea5e9 is bright enough that MUI's contrast
          // threshold picks dark text — but its own near-black, not this one.
          contrastText: "#04212E",
        },
        secondary: {
          // Brass against the sky blue: the instrument-dial accent, used for
          // anything advisory that is not itself a risk.
          main: "#B4530A",
          light: "#DC7B27",
          dark: "#7E3803",
          contrastText: "#FFFFFF",
        },
        success: { main: "#12805A", contrastText: "#FFFFFF" },
        warning: { main: "#B07100", contrastText: "#FFFFFF" },
        error: { main: "#A31515", contrastText: "#FFFFFF" },
        info: { main: "#0A6E9E", contrastText: "#FFFFFF" },
        background: {
          // Not white. The surfaces are white, so the page has to sit behind
          // them or a card has no edge without a shadow.
          default: "#F1F5F9",
          paper: "#FFFFFF",
        },
        text: {
          primary: "#0C1B26",
          secondary: "#4A5C6B",
          disabled: "#8B9AA6",
        },
        divider: "rgba(12, 27, 38, 0.14)",
        risk: risk.light,
      },
    },
    dark: {
      palette: {
        primary: {
          // Lifted off #0ea5e9: the brand blue is only ~2.4:1 on the dark
          // background, which is unreadable as text and weak as an icon.
          main: "#4FC3F7",
          light: "#8AD8FA",
          dark: "#1E88B8",
          contrastText: "#04212E",
        },
        secondary: {
          main: "#F0A54A",
          light: "#F6C289",
          dark: "#B4700F",
          contrastText: "#1A1204",
        },
        success: { main: "#3DD68C", contrastText: "#04150E" },
        warning: { main: "#F0B429", contrastText: "#1A1204" },
        error: { main: "#F76A6A", contrastText: "#1C0606" },
        info: { main: "#4FC3F7", contrastText: "#04212E" },
        background: {
          // Near-black with a blue cast, not pure black: pure black behind a
          // bright readout makes the halo that hurts at night.
          default: "#080E14",
          paper: "#101A22",
        },
        text: {
          primary: "#E7EEF4",
          secondary: "#A0B2C0",
          disabled: "#63757F",
        },
        divider: "rgba(231, 238, 244, 0.14)",
        risk: risk.dark,
      },
    },
  },

  shape: {
    // 8 is the unit the rest of the scale derives from, and AppTheme.test.tsx
    // pins it. Larger radii are set per component below.
    borderRadius: 8,
  },

  typography: {
    fontFamily: FONT_STACK,

    // Headings are tight and slightly negative-tracked — display type, not body
    // type set large.
    h1: {
      fontSize: "3rem",
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: "-0.025em",
      ...TABULAR,
    },
    h2: {
      fontSize: "2.25rem",
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: "-0.022em",
      ...TABULAR,
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 700,
      lineHeight: 1.15,
      letterSpacing: "-0.018em",
      ...TABULAR,
    },
    h4: {
      fontSize: "1.375rem",
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: "-0.014em",
      ...TABULAR,
    },
    h5: {
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: "-0.008em",
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: "-0.004em",
    },

    subtitle1: { fontSize: "1rem", fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.45 },
    body1: { fontSize: "0.9375rem", lineHeight: 1.6 },
    body2: { fontSize: "0.8125rem", lineHeight: 1.55 },
    caption: { fontSize: "0.75rem", lineHeight: 1.45 },

    overline: {
      fontSize: "0.6875rem",
      fontWeight: 700,
      letterSpacing: "0.12em",
      lineHeight: 1.4,
      textTransform: "uppercase",
    },

    button: {
      fontWeight: 600,
      letterSpacing: "0.01em",
      // Shouted labels cost legibility and gain nothing.
      textTransform: "none",
    },

    /**
     * The hero figure. `clamp` rather than breakpoints because it has to hold
     * at 360px — the temperature is the one thing that must never wrap.
     */
    readout: {
      fontFamily: FONT_STACK,
      fontSize: "clamp(3.5rem, 16vw, 5.5rem)",
      fontWeight: 300,
      lineHeight: 0.92,
      letterSpacing: "-0.04em",
      ...TABULAR,
    },
    metric: {
      fontFamily: FONT_STACK,
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.15,
      letterSpacing: "-0.02em",
      ...TABULAR,
    },
    label: {
      fontFamily: FONT_STACK,
      fontSize: "0.6875rem",
      fontWeight: 700,
      lineHeight: 1.4,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
    },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          scrollBehavior: "smooth",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          // Stops iOS inflating the hero readout in landscape.
          WebkitTextSizeAdjust: "100%",
        },
        body: {
          // Weather data is dense; overscroll-bouncing the whole page under a
          // sticky dashboard header reads as a broken layout.
          overscrollBehaviorY: "none",
        },
        /**
         * A focus ring on everything focusable, not only MUI components.
         * `theme.focusVisible` covers MUI's own; this covers a bare anchor or a
         * `tabIndex` container inside a dashboard.
         */
        ":focus-visible": {
          outline: "2px solid var(--mui-palette-primary-main)",
          outlineOffset: 3,
        },
        "::selection": {
          backgroundColor: "var(--mui-palette-primary-main)",
          color: "var(--mui-palette-primary-contrastText)",
        },
        /**
         * Honoured globally rather than per component. Someone who has asked
         * the OS for less motion should not have to be sold on it again by a
         * chart that sweeps in — and `scroll-behavior: smooth` above is itself
         * motion, so it has to be reverted here too.
         */
        "@media (prefers-reduced-motion: reduce)": {
          "html:focus-within": { scrollBehavior: "auto" },
          "*, *::before, *::after": {
            animationDuration: "0.01ms !important",
            animationIterationCount: "1 !important",
            transitionDuration: "0.01ms !important",
            scrollBehavior: "auto !important",
          },
        },
      },
    },

    MuiPaper: {
      defaultProps: {
        // Flat by default. Depth is carried by the border and the background
        // step, so an elevated surface means something when it does appear.
        elevation: 0,
      },
      styleOverrides: {
        root: {
          // MUI's dark-mode elevation overlay is a background-image; against a
          // bordered flat surface it only muddies the paper colour.
          backgroundImage: "none",
        },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 14,
          border: `1px solid ${t.vars.palette.divider}`,
          backgroundColor: t.vars.palette.background.paper,
        }),
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          // MUI's default 24px last-child padding leaves cards visibly
          // bottom-heavy in a grid of tiles.
          "&:last-child": { paddingBottom: 20 },
        },
      },
    },

    MuiCardHeader: {
      styleOverrides: {
        root: { padding: "20px 20px 8px" },
        title: { fontSize: "1rem", fontWeight: 600, letterSpacing: "-0.004em" },
        subheader: { fontSize: "0.8125rem" },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          letterSpacing: "0.005em",
          ...TABULAR,
        },
        sizeSmall: { height: 22, fontSize: "0.75rem" },
        label: { paddingInline: 10 },
      },
    },

    MuiButton: {
      defaultProps: {
        // The shadow under a contained button is the piece of Material depth
        // that fights the flat-surface treatment hardest.
        disableElevation: true,
      },
      styleOverrides: {
        root: { borderRadius: 10, paddingInline: 16 },
        sizeSmall: { paddingInline: 12 },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 12,
          border: `1px solid ${t.vars.palette.divider}`,
        }),
      },
    },

    MuiSkeleton: {
      defaultProps: {
        // Wave, so a skeleton screen is distinguishable from a layout that has
        // finished loading empty.
        animation: "wave",
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 6 },
        bar: { borderRadius: 999 },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: "0.75rem", borderRadius: 8, paddingBlock: 6 },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: ({ theme: t }) => ({ borderColor: t.vars.palette.divider }),
      },
    },

    MuiTypography: {
      defaultProps: {
        // Custom variants have no implied element, so without this they all
        // render as <span> and the readout stops being a block.
        variantMapping: {
          readout: "div",
          metric: "div",
          label: "span",
        },
      },
    },
  },
});

export default theme;
