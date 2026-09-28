import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { swellSeparation } from "@/features/marine/lib/seaState";

export interface SwellSplitCardProps {
  swellHeight: number | null;
  windWaveHeight: number | null;
}

/**
 * Swell against wind wave, as a proportional bar.
 *
 * The reading a significant wave height cannot give: 1.5 m of long-period
 * swell is a gentle roll, and 1.5 m of wind wave on the same day is short,
 * steep and wet. Drawn as one bar in two parts because the ratio is the point —
 * two percentages side by side make the reader do the comparison themselves.
 *
 * Renders nothing when either component is missing. An inland or edge-of-model
 * coordinate has no split to show, and half a bar would imply one.
 */
export function SwellSplitCard({
  swellHeight,
  windWaveHeight,
}: SwellSplitCardProps) {
  const split = swellSeparation(swellHeight, windWaveHeight);
  if (!split) return null;

  const swellPercent = Math.round(split.swellShare * 100);
  const windPercent = 100 - swellPercent;

  return (
    <Card>
      <CardHeader
        title="Swell against wind wave"
        subheader="The part of the sea that arrived from elsewhere, against the part this wind is making"
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">{split.description}</Typography>

          <Stack
            direction="row"
            role="img"
            aria-label={`Swell ${swellPercent} per cent of the combined height, wind wave ${windPercent} per cent`}
            sx={{ height: 10, borderRadius: 999, overflow: "hidden" }}
          >
            <Box
              sx={{
                width: `${split.swellShare * 100}%`,
                backgroundColor: "primary.main",
              }}
            />
            <Box sx={{ flex: 1, backgroundColor: "secondary.main" }} />
          </Stack>

          <Stack
            direction="row"
            spacing={2}
            sx={{ justifyContent: "space-between" }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Swell {swellHeight?.toFixed(1) ?? "—"} m · {swellPercent}%
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Wind wave {windWaveHeight?.toFixed(1) ?? "—"} m · {windPercent}%
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
