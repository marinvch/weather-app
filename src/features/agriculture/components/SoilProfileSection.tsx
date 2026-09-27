import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import OpacityIcon from "@mui/icons-material/Opacity";
import { MetricTile } from "@/shared/ui/MetricTile";
import { QueryState } from "@/shared/ui/QueryState";
import { formatTemperature, unitsFor } from "@/shared/lib/units";
import type { Coordinates } from "@/shared/types/weather";
import { useAppSelector } from "@/store/hooks";
import { useGetSoilDataQuery } from "@/features/agriculture/api/agricultureApi";
import {
  tileSeverity,
  soilMoistureCondition,
  soilMoisturePercent,
} from "@/features/agriculture/lib/conditions";

/**
 * The deeper soil profile — **its own query, and its own loading state.**
 *
 * This is the fix for the documented bug in `src/features/AGENTS.md`: the
 * dashboard issued two queries and gated the whole view on both, so a slow soil
 * response blanked the frost warning as well. Each section now renders against
 * the query that feeds it, and a stalled soil profile costs the reader one card
 * rather than the page.
 */
export function SoilProfileSection({
  coordinates,
}: {
  coordinates: Coordinates;
}) {
  const units = useAppSelector((state) => state.userProfile.units);
  const unitSet = unitsFor(units);
  const { data, isLoading, error } = useGetSoilDataQuery(coordinates);

  const hourly = data?.hourly;
  const hour = 0;

  const layers = [
    { label: "Surface (0–1 cm)", raw: hourly?.soil_moisture_0_1cm?.[hour] },
    { label: "Shallow (1–3 cm)", raw: hourly?.soil_moisture_1_3cm?.[hour] },
    { label: "Root zone (3–9 cm)", raw: hourly?.soil_moisture_3_9cm?.[hour] },
  ];

  const temps = [
    { label: "0 cm", value: hourly?.soil_temperature_0cm?.[hour] },
    { label: "6 cm", value: hourly?.soil_temperature_6cm?.[hour] },
    { label: "18 cm", value: hourly?.soil_temperature_18cm?.[hour] },
  ];

  return (
    <Card>
      <CardHeader
        title="Soil profile"
        subheader="Moisture by depth, converted from the model's m³/m³ to a percentage"
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <QueryState
          isLoading={isLoading}
          error={error}
          hasData={Boolean(hourly)}
          loadingLabel="Loading the soil profile…"
          errorTitle="Could not load the soil profile"
          incompleteMessage="The forecast came back without soil layers for this point."
        >
          {() => (
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                }}
              >
                {layers.map((layer) => {
                  // m³/m³ in, percentage out — before any comparison. Raw, every
                  // one of these reads "Very dry, irrigate immediately".
                  const percent =
                    typeof layer.raw === "number" && Number.isFinite(layer.raw)
                      ? soilMoisturePercent(layer.raw)
                      : null;
                  const reading =
                    percent == null ? null : soilMoistureCondition(percent);

                  return (
                    <MetricTile
                      key={layer.label}
                      label={layer.label}
                      value={percent == null ? "—" : percent.toFixed(1)}
                      unit="%"
                      icon={<OpacityIcon />}
                      severity={tileSeverity(reading?.severity)}
                      hint={reading?.text ?? "Not reported"}
                    />
                  );
                })}
              </Box>

              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                {temps.map((t) => (
                  <Chip
                    key={t.label}
                    size="small"
                    variant="outlined"
                    label={`${t.label}: ${
                      typeof t.value === "number"
                        ? formatTemperature(t.value, unitSet.temperature)
                        : "—"
                    }`}
                  />
                ))}
              </Stack>
            </Stack>
          )}
        </QueryState>
      </CardContent>
    </Card>
  );
}
