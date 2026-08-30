import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AdviceCard } from "@/shared/ui/AdviceCard";
import { QueryState } from "@/shared/ui/QueryState";
import { useAppSelector } from "@/store/hooks";
import { useAgronomicData } from "@/features/agriculture/hooks/useAgronomicData";
import {
  frostRisk,
  growingConditions,
  severityColor,
  soilMoistureCondition,
  soilMoisturePercent,
} from "@/features/agriculture/lib/conditions";
import type { Coordinates } from "@/shared/types/weather";

interface AgriculturalDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

function StatTile({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color?: "success" | "warning" | "error";
}) {
  return (
    <Card sx={{ flex: "1 1 200px", minWidth: 200 }}>
      <CardContent sx={{ textAlign: "center" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            my: 0.5,
            color: color ? `${color}.main` : undefined,
          }}
        >
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {detail}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function AgriculturalDashboard({
  coordinates,
}: AgriculturalDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);

  // Only the agronomic query gates the view. The soil query used to be awaited
  // alongside it, so a slow soil response blocked everything.
  const { data, isLoading, error, advice } = useAgronomicData(coordinates);

  const current = data?.current;

  return (
    <QueryState
      isLoading={isLoading}
      error={error}
      hasData={Boolean(current)}
      loadingLabel="Loading growing conditions…"
      errorTitle="Could not load agricultural data"
      incompleteMessage="The forecast came back without soil readings for this point."
    >
      {() => current && (
        <Stack spacing={3}>
          {(() => {
            // The API answers in m³/m³; every threshold below is a percentage.
            const soilMoisture = soilMoisturePercent(
              current.soil_moisture_0_1cm ?? 0,
            );
            const soilTemp = current.soil_temperature_0cm ?? 0;
            const soil = soilMoistureCondition(soilMoisture);
            const frost = frostRisk(current.temperature_2m);
            const growing = growingConditions(
              current.temperature_2m,
              current.relative_humidity_2m,
              soilMoisture,
            );

            return (
              <>
                <Stack
                  direction="row"
                  sx={{ flexWrap: "wrap", gap: 2 }}
                >
                  <StatTile
                    label="Air temperature"
                    value={
                      units === "metric"
                        ? `${Math.round(current.temperature_2m)}°C`
                        : `${Math.round((current.temperature_2m * 9) / 5 + 32)}°F`
                    }
                    detail={`Soil ${Math.round(soilTemp)}°C`}
                  />
                  <StatTile
                    label="Soil moisture"
                    value={`${soilMoisture.toFixed(1)}%`}
                    detail={soil.text}
                    color={severityColor(soil.severity)}
                  />
                  <StatTile
                    label="Frost risk"
                    value={frost.text}
                    detail="Tonight"
                    color={severityColor(frost.severity)}
                  />
                  <StatTile
                    label="Growing conditions"
                    value={growing.condition}
                    detail="Overall"
                    color={severityColor(growing.severity)}
                  />
                </Stack>

                <Card>
                  <CardHeader
                    title="What to do"
                    slotProps={{ title: { variant: "h6", component: "h2" } }}
                  />
                  <CardContent>
                    <Stack spacing={2}>
                      <Alert severity={severityColor(soil.severity) === "success" ? "success" : "warning"}>
                        <AlertTitle>Soil moisture</AlertTitle>
                        {soil.advice}
                      </Alert>
                      <Alert severity={severityColor(frost.severity) === "success" ? "success" : "warning"}>
                        <AlertTitle>Frost protection</AlertTitle>
                        {frost.advice}
                      </Alert>
                      {(current.wind_speed_10m ?? 0) > 30 && (
                        <Alert severity="warning">
                          <AlertTitle>High wind</AlertTitle>
                          Hold off on spraying — drift is likely at{" "}
                          {Math.round(current.wind_speed_10m ?? 0)} km/h.
                        </Alert>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </>
            );
          })()}

          {advice && <AdviceCard advice={advice} title="Growing advice" />}
        </Stack>
      )}
    </QueryState>
  );
}
