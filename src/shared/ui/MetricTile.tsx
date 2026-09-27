import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { RISK_LEVELS } from "@/shared/types/weather";

/** Presentation severity, 0 benign to 3 hazardous — the `RISK_LEVELS` index. */
export type Severity = 0 | 1 | 2 | 3;

export interface MetricTileProps {
  /** The reading's name. Rendered as a small-caps label. */
  label: string;
  /**
   * The formatted figure, without its unit — `"18"`, not `"18 km/h"`. Pass it
   * through `@/shared/lib/units`; this component does not convert, because it
   * cannot know whether a bare number is Celsius, km/h or mm.
   */
  value: ReactNode;
  /** The unit, set apart from the figure so a column of tiles aligns. */
  unit?: string;
  icon?: ReactNode;
  severity?: Severity;
  /** One short line under the figure: a threshold, a time, a caveat. */
  hint?: string;
  trend?: "up" | "down" | "flat";
}

const TREND_ICON = {
  up: TrendingUpIcon,
  down: TrendingDownIcon,
  flat: TrendingFlatIcon,
} as const;

const TREND_LABEL = {
  up: "rising",
  down: "falling",
  flat: "steady",
} as const;

/**
 * The atom every dashboard is built from: one reading, scannable in a grid.
 *
 * Severity tints the tile from the `risk` palette, but never *only* tints it —
 * a coloured background is invisible to a colour-blind reader and to anyone in
 * direct sunlight. Above severity 0 the tile also grows a left accent rule and
 * announces the level in its accessible name, so the same information survives
 * both the colour and the screen.
 *
 * Deliberately not clickable. A tile is a readout; anything that needs an
 * action wraps it, so the whole grid does not become a tab stop.
 */
export function MetricTile({
  label,
  value,
  unit,
  icon,
  severity = 0,
  hint,
  trend,
}: MetricTileProps) {
  const level = RISK_LEVELS[severity];
  const TrendIcon = trend ? TREND_ICON[trend] : null;

  // The accessible name has to carry everything the eye gets from colour and
  // position, in reading order: what it is, what it says, how it is moving,
  // how bad it is.
  const accessibleName = [
    label,
    typeof value === "string" || typeof value === "number" ? String(value) : "",
    unit,
    trend ? TREND_LABEL[trend] : "",
    severity > 0 ? `${level} risk` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Paper
      role="group"
      aria-label={accessibleName}
      sx={(theme) => ({
        position: "relative",
        overflow: "hidden",
        p: 1.75,
        pl: severity > 0 ? 2.25 : 1.75,
        borderRadius: 3,
        border: "1px solid",
        borderColor:
          severity > 0
            ? theme.vars.palette.risk[level].border
            : theme.vars.palette.divider,
        backgroundColor:
          severity > 0
            ? theme.vars.palette.risk[level].soft
            : theme.vars.palette.background.paper,
        // The non-colour half of the severity signal: a rule whose thickness
        // steps with the level, readable in greyscale.
        ...(severity > 0 && {
          "&::before": {
            content: '""',
            position: "absolute",
            insetBlock: 0,
            insetInlineStart: 0,
            width: severity * 2,
            backgroundColor: theme.vars.palette.risk[level].main,
          },
        }),
      })}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mb: 0.75 }}>
        {icon && (
          <Box
            aria-hidden
            sx={(theme) => ({
              display: "flex",
              color:
                severity > 0
                  ? theme.vars.palette.risk[level].main
                  : theme.vars.palette.text.secondary,
              "& > *": { fontSize: 18 },
            })}
          >
            {icon}
          </Box>
        )}
        <Typography
          variant="label"
          sx={(theme) => ({
            color:
              severity > 0
                ? theme.vars.palette.risk[level].text
                : theme.vars.palette.text.secondary,
          })}
        >
          {label}
        </Typography>
      </Stack>

      <Stack direction="row" spacing={0.5} sx={{ alignItems: "baseline" }}>
        <Typography variant="metric" component="span">
          {value}
        </Typography>
        {unit && (
          <Typography
            component="span"
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 600 }}
          >
            {unit}
          </Typography>
        )}
        {TrendIcon && (
          <TrendIcon
            aria-hidden
            sx={{
              fontSize: 18,
              ml: 0.25,
              // Baseline-aligned text pushes an icon too high; nudge it back.
              alignSelf: "center",
              color: "text.secondary",
            }}
          />
        )}
      </Stack>

      {hint && (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          {hint}
        </Typography>
      )}
    </Paper>
  );
}
