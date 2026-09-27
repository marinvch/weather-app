import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import {
  ARROW_RAMP,
  binRanges,
  resolveScaleMax,
  type DirectionFieldSpec,
} from "@/shared/lib/arrowField";

export interface DirectionFieldLegendProps {
  field: DirectionFieldSpec;
}

/**
 * The key for an arrow field: what the colours mean, and which way the arrows
 * point.
 *
 * The convention line is the part that matters. Open-Meteo reports wind as the
 * direction it blows *from* and waves as the direction they travel *towards*,
 * so a map showing both has two identically drawn arrow fields whose numbers
 * mean opposite things. The arrows are normalised — they all point downstream —
 * and this line says so, because otherwise a mariner comparing an arrow against
 * a printed forecast has no way to tell which of us flipped it.
 */
export function DirectionFieldLegend({ field }: DirectionFieldLegendProps) {
  const theme = useTheme();
  const scaleMax = resolveScaleMax(field.samples, field.scaleMax);
  const ranges = binRanges(scaleMax);

  const convention =
    field.convention === "from"
      ? `Reported as the direction it comes from; arrows point the way it is going.`
      : `Reported as the direction it travels towards; arrows point the same way.`;

  return (
    <Box
      component="figure"
      sx={{ m: 0, p: 0 }}
      aria-label={`${field.name} legend, ${field.unit}`}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
      >
        <Typography variant="label" sx={{ color: "text.secondary" }}>
          {field.name}
        </Typography>

        {ranges.map((range) => (
          <Stack
            key={range.bin}
            direction="row"
            spacing={0.5}
            sx={{ alignItems: "center" }}
          >
            {/*
              The swatch is an arrow, not a square: the legend then shows both
              things the ramp encodes — colour and glyph size — in one mark.
            */}
            <Box
              aria-hidden
              component="svg"
              viewBox="0 0 24 24"
              sx={{
                width: 12 + range.bin * 3,
                height: 12 + range.bin * 3,
                flexShrink: 0,
                transform: "rotate(90deg)",
              }}
            >
              <path
                d="M12 1.6 19.6 21.8 12 17.2 4.4 21.8Z"
                fill={theme.vars.palette.risk[ARROW_RAMP[range.bin]].main}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth={1.1}
                strokeLinejoin="round"
              />
            </Box>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {range.label}
            </Typography>
          </Stack>
        ))}

        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {field.unit}
        </Typography>
      </Stack>

      <Typography
        component="figcaption"
        variant="caption"
        sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
      >
        {convention}
      </Typography>
    </Box>
  );
}
