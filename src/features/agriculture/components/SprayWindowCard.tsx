import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { RiskGauge } from "@/shared/ui/RiskGauge";
import {
  assessSprayConditions,
  findSprayWindows,
  type HourlySprayInput,
  type SprayConditions,
} from "@/features/agriculture/lib/spray";

export interface SprayWindowCardProps {
  now: SprayConditions;
  hourly: HourlySprayInput | undefined;
}

const VERDICT_HEADING = {
  go: "Spray window open",
  caution: "Sprayable with care",
  "no-go": "Do not spray",
} as const;

/** `2026-09-05T14:00` as `Fri 14:00`, falling back to the raw string. */
function hourLabel(iso: string | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? iso
    : parsed.toLocaleString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/**
 * Go / no-go for spraying, now and over the next 48 hours.
 *
 * The forward window is the part with real value: "not right now" is only half
 * an answer, and the run of hours when conditions do settle is the other half.
 * Runs shorter than two hours are not offered at all — that is not enough time
 * to fill, travel and spray.
 */
export function SprayWindowCard({ now, hourly }: SprayWindowCardProps) {
  const assessment = assessSprayConditions(now);
  const windows = findSprayWindows(hourly, { hours: 48 }).slice(0, 4);

  return (
    <Card>
      <CardHeader
        title="Spray window"
        subheader="Wind, rain, humidity and temperature judged together"
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <Stack spacing={2}>
          <RiskGauge
            level={assessment.risk}
            label={VERDICT_HEADING[assessment.verdict]}
            description={assessment.summary}
          />

          {assessment.reasons.length > 0 && (
            <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, m: 0 }}>
              {assessment.reasons.map((reason) => (
                <Typography key={reason} component="li" variant="body2">
                  {reason}
                </Typography>
              ))}
            </Stack>
          )}

          <Box>
            <Typography variant="label" sx={{ color: "text.secondary" }}>
              Next 48 hours
            </Typography>
            {windows.length === 0 ? (
              <Typography variant="body2" sx={{ mt: 0.75 }}>
                No window of two hours or more in the next 48. Conditions do not
                settle long enough to fill, travel and spray.
              </Typography>
            ) : (
              <Stack spacing={1} sx={{ mt: 0.75 }}>
                {windows.map((window) => (
                  <Stack
                    key={window.startTime}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Chip
                      size="small"
                      color={window.verdict === "go" ? "success" : "warning"}
                      label={window.verdict === "go" ? "Clear" : "With care"}
                    />
                    <Typography variant="body2">
                      {hourLabel(window.startTime)} →{" "}
                      {hourLabel(window.endTime)} · {window.hours} h
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>

          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Generic guidance from published label conditions. The specific
            product's label always wins — including its own wind, rainfast and
            temperature limits.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
