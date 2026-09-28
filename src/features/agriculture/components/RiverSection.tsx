import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import WaterIcon from "@mui/icons-material/Water";
import { MetricTile } from "@/shared/ui/MetricTile";
import { QueryState } from "@/shared/ui/QueryState";
import { RiskGauge } from "@/shared/ui/RiskGauge";
import type { Coordinates } from "@/shared/types/weather";
import { useGetRiverDischargeQuery } from "@/features/agriculture/api/riverApi";
import { tileSeverityFromRiskLevel } from "@/features/agriculture/lib/conditions";
import {
  RIVER_DISCHARGE_CAVEAT,
  hasRiverData,
  readRiverDischarge,
} from "@/features/agriculture/lib/river";

/**
 * River discharge — its own query, against a **fourth Open-Meteo host**.
 *
 * GloFAS answers a coordinate with no modelled river with 200 and a series of
 * nulls, so this says "no modelled river here" rather than rendering an empty
 * chart — the same honest-empty case as the marine dashboard's. It is handled
 * here rather than by the shell because it costs one card, not the page.
 */
export function RiverSection({ coordinates }: { coordinates: Coordinates }) {
  const { data, isLoading, isUninitialized, error } =
    useGetRiverDischargeQuery(coordinates);
  const reading = readRiverDischarge(data);

  // Three outcomes that must never look alike:
  //
  //   "no modelled river here"  — a 200 with a series of nulls. An answer.
  //   "no response"             — the request has not resolved.
  //   "never asked"             — `isUninitialized`, which is what an
  //                               unregistered `floodApi` middleware looks
  //                               like: RTK Query raises no error, the query
  //                               simply never fires.
  //
  // Collapsing the third into either of the others would cost us the only
  // signal that the store wiring is broken, because the symptom of a missing
  // `.concat(floodApi.middleware)` is silence, not a failure.
  const neverFired = isUninitialized && !isLoading;

  return (
    <Card>
      <CardHeader
        title="River discharge"
        subheader="Modelled flow in the nearest GloFAS river cell"
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <QueryState
          isLoading={isLoading}
          error={error}
          hasData={hasRiverData(data)}
          loadingLabel="Loading river discharge…"
          errorTitle="Could not load river discharge"
          incompleteMessage={
            neverFired
              ? "The river query never ran. That is a wiring fault rather than a fact about this location — floodApi needs both its reducer and its middleware registered in the store."
              : "No modelled river near this point, so there is no discharge to report. That is an answer, not a failure — GloFAS only covers modelled watercourses."
          }
        >
          {() =>
            reading && (
              <Stack spacing={2}>
                <RiskGauge
                  level={reading.risk}
                  label={`River ${reading.text.toLowerCase()}`}
                  description={reading.advice}
                />

                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                  }}
                >
                  <MetricTile
                    label="Today"
                    value={reading.currentM3s.toFixed(0)}
                    unit="m³/s"
                    icon={<WaterIcon />}
                  />
                  <MetricTile
                    label="Forecast peak"
                    value={reading.peakM3s.toFixed(0)}
                    unit="m³/s"
                    icon={<WaterIcon />}
                    severity={tileSeverityFromRiskLevel(reading.risk)}
                    hint={
                      reading.daysToPeak === 0
                        ? "Today is the peak"
                        : `In ${reading.daysToPeak} day${reading.daysToPeak === 1 ? "" : "s"}`
                    }
                  />
                  <MetricTile
                    label="Peak against today"
                    value={`${reading.peakRatio.toFixed(2)}×`}
                    icon={<WaterIcon />}
                    severity={tileSeverityFromRiskLevel(reading.risk)}
                    trend={
                      reading.peakRatio > 1.05
                        ? "up"
                        : reading.peakRatio < 0.95
                          ? "down"
                          : "flat"
                    }
                  />
                </Box>

                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {RIVER_DISCHARGE_CAVEAT}
                </Typography>
              </Stack>
            )
          }
        </QueryState>
      </CardContent>
    </Card>
  );
}
