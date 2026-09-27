import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import DangerousRoundedIcon from "@mui/icons-material/DangerousRounded";
import { RISK_LEVELS, type RiskLevel } from "@/shared/types/weather";

export interface RiskGaugeProps {
  level: RiskLevel;
  /** 0–100. Shown alongside the level when the scorer produced one. */
  score?: number;
  /** Overrides the default heading — "Moderate risk", "Sea state", … */
  label?: string;
  /** One sentence saying what drove the level. */
  description?: string;
}

/**
 * Each level gets its own *shape*, not just its own colour.
 *
 * A tick, an info disc, a triangle and an octagon are four different outlines,
 * so the level survives greyscale printing, a colour-blind reader and a phone
 * in sunlight. The word is always present too — the segment count is the third
 * channel. Nothing here is legible through colour alone, which is the whole
 * point of the component.
 */
const LEVEL_ICON = {
  low: CheckCircleRoundedIcon,
  moderate: InfoRoundedIcon,
  high: WarningRoundedIcon,
  severe: DangerousRoundedIcon,
} as const;

const LEVEL_HEADING: Record<RiskLevel, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
  severe: "Severe risk",
};

/**
 * A severity readout with four filled-segment steps.
 *
 * The segments are the reason this is not a coloured `Chip`: a chip says
 * "orange", a four-segment bar with three lit says "three out of four", which
 * is the thing a reader actually needs and the only part of it that works
 * without colour.
 *
 * `level` is the four-step display scale from `@/shared/types/weather`. An
 * Analysis's three-step `riskLevel` is a different scale — widen it with
 * `riskLevelFromAnalysis` rather than casting, or "medium" silently fails to
 * match any key here.
 */
export function RiskGauge({ level, score, label, description }: RiskGaugeProps) {
  const Icon = LEVEL_ICON[level];
  const step = RISK_LEVELS.indexOf(level) + 1;
  const heading = label ?? LEVEL_HEADING[level];

  return (
    <Paper
      sx={(theme) => ({
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: theme.vars.palette.risk[level].border,
        backgroundColor: theme.vars.palette.risk[level].soft,
      })}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Icon
          aria-hidden
          sx={(theme) => ({
            fontSize: 28,
            flexShrink: 0,
            color: theme.vars.palette.risk[level].main,
          })}
        />

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "baseline", flexWrap: "wrap" }}
          >
            <Typography
              variant="h6"
              component="p"
              sx={(theme) => ({ color: theme.vars.palette.risk[level].text })}
            >
              {heading}
            </Typography>
            {score !== undefined && Number.isFinite(score) && (
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}
              >
                score {Math.round(score)}/100
              </Typography>
            )}
          </Stack>

          {/*
            The segments carry the level for anyone who cannot use the colour.
            `role="img"` with a full label, because four adjacent divs otherwise
            announce as nothing at all — and the label repeats the step count so
            it is not a decoration a screen reader has to infer.
          */}
          <Stack
            role="img"
            aria-label={`${heading}: step ${step} of ${RISK_LEVELS.length}`}
            direction="row"
            spacing={0.5}
            sx={{ mt: 1, mb: description ? 1 : 0 }}
          >
            {RISK_LEVELS.map((_, index) => {
              const lit = index < step;
              return (
                <Box
                  key={index}
                  sx={(theme) => ({
                    height: 8,
                    flex: 1,
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor: theme.vars.palette.risk[level].border,
                    backgroundColor: lit
                      ? theme.vars.palette.risk[level].main
                      : "transparent",
                  })}
                />
              );
            })}
          </Stack>

          {description && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {description}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
