import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatSpeed, type UnitSet } from "@/shared/lib/units";
import {
  ascentWindProfile,
  riskLevelFromSeverity,
  windAmplification,
  type AscentBand,
} from "@/features/mountain/lib/conditions";

export interface AscentWindProfileCardProps {
  current: {
    wind_speed_10m?: number;
    wind_speed_80m?: number;
    wind_speed_120m?: number;
  };
  unitSet: UnitSet;
}

/**
 * One band of the profile.
 *
 * The bar is the point of the row: three numbers in a column are read as three
 * numbers, while three bars against a shared scale are read as a gradient — and
 * the gradient is what says whether the valley reading has anything to do with
 * the ridge.
 */
function BandRow({
  band,
  scaleMax,
  unitSet,
}: {
  band: AscentBand;
  scaleMax: number;
  unitSet: UnitSet;
}) {
  const riskLevel = riskLevelFromSeverity(band.condition?.severity);

  return (
    <Stack spacing={0.75} sx={{ py: 1.25 }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: "baseline", justifyContent: "space-between" }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{band.label}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {band.sublabel}
          </Typography>
        </Box>
        <Stack spacing={0.25} sx={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Typography
            sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
          >
            {band.speedKmh != null
              ? formatSpeed(band.speedKmh, unitSet.speed)
              : "—"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {/* A level the model did not return must not read as calm. */}
            {band.condition?.text ?? "Not reported at this level"}
          </Typography>
        </Stack>
      </Stack>

      {band.speedKmh != null && (
        <LinearProgress
          variant="determinate"
          aria-hidden
          value={Math.min(100, (band.speedKmh / scaleMax) * 100)}
          sx={(theme) => ({
            height: 8,
            borderRadius: 999,
            backgroundColor: theme.vars.palette.action.hover,
            "& .MuiLinearProgress-bar": {
              borderRadius: 999,
              backgroundColor: theme.vars.palette.risk[riskLevel].main,
            },
          })}
        />
      )}
    </Stack>
  );
}

/**
 * Wind at three heights above ground, as an ascent profile.
 *
 * These are heights **above ground level**, not altitudes — 120 m AGL is not
 * the summit, it is the air 120 m over whatever terrain the model has here. It
 * stands in for ridge exposure because wind accelerates away from surface
 * friction the same way it does over a ridge, and it is the closest a point
 * forecast comes to telling you what a col will feel like.
 */
export function AscentWindProfileCard({
  current,
  unitSet,
}: AscentWindProfileCardProps) {
  const bands = ascentWindProfile(current);
  const amplification = windAmplification(bands);

  // One shared scale, so the three bars compare. 60 km/h is the top of the
  // "Windy" band, which keeps an ordinary day off the ceiling.
  const scaleMax = Math.max(60, ...bands.map((b) => b.speedKmh ?? 0));

  return (
    <Card>
      <CardHeader
        title="Ascent wind profile"
        subheader="Heights above ground, not altitudes — a proxy for how much more wind a ridge or col gets than the valley"
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <Stack
          divider={
            <Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />
          }
        >
          {bands.map((band) => (
            <BandRow
              key={band.heightAgl}
              band={band}
              scaleMax={scaleMax}
              unitSet={unitSet}
            />
          ))}
        </Stack>

        {amplification != null && (
          <Typography
            variant="body2"
            sx={{
              mt: 1.5,
              color: amplification >= 1.5 ? "warning.main" : "text.secondary",
            }}
          >
            Wind aloft is {amplification.toFixed(1)}× the surface reading
            {amplification >= 1.5
              ? " — the valley figure is not telling you about the ridge."
              : "."}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
