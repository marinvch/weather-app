import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  describeAccumulation,
  type GddAccumulation,
} from "@/features/agriculture/lib/gdd";

/**
 * The top of the bar scale, in degree-days.
 *
 * 20 GDD is a hot day at base 10°C — a bar that reaches the end means the crop
 * had about as much growing weather as one day can give it. A scale off the
 * window's own maximum would make every week look identical.
 */
const BAR_SCALE_MAX_GDD = 20;

/**
 * Accumulated warmth over the forecast window, day by day.
 *
 * The bars are the point: seven numbers in a column are read as seven numbers,
 * seven bars are read as a shape — and the shape is what says whether the week
 * front-loads its growing weather or saves it.
 *
 * Renders nothing when the window has no usable days, rather than an empty
 * frame.
 */
export function DegreeDayCard({
  accumulation,
}: {
  accumulation: GddAccumulation;
}) {
  if (accumulation.days.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Growing degree days"
        subheader={`Base ${accumulation.base}°C — accumulated warmth, not elapsed days`}
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="body2">
            {describeAccumulation(accumulation)}
          </Typography>

          <Stack spacing={0.75}>
            {accumulation.days.map((day) => (
              <Stack
                key={day.date}
                direction="row"
                spacing={2}
                sx={{ alignItems: "center" }}
              >
                <Typography
                  variant="body2"
                  sx={{ width: 92, flexShrink: 0, color: "text.secondary" }}
                >
                  {day.date}
                </Typography>
                <Box
                  aria-hidden
                  sx={{
                    flex: 1,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: "action.hover",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: `${Math.min(100, (day.gdd / BAR_SCALE_MAX_GDD) * 100)}%`,
                      backgroundColor: "primary.main",
                    }}
                  />
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    width: 88,
                    flexShrink: 0,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {day.gdd.toFixed(1)} / {day.cumulative.toFixed(0)}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Daily / cumulative. This is the forecast window's contribution, not
            an accumulation from planting.
            {accumulation.skipped > 0 &&
              ` ${accumulation.skipped} day${accumulation.skipped === 1 ? "" : "s"} had no temperatures and ${accumulation.skipped === 1 ? "is" : "are"} excluded.`}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
