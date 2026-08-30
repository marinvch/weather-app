import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AdviceCard } from "@/shared/ui/AdviceCard";
import { QueryState } from "@/shared/ui/QueryState";
import { useAppSelector } from "@/store/hooks";
import { useMountainForecast } from "@/features/mountain/hooks/useMountainForecast";
import {
  avalancheRisk,
  severityColor,
  visibilityCondition,
  windCondition,
} from "@/features/mountain/lib/conditions";
import type { Coordinates } from "@/shared/types/weather";

interface MountainDashboardProps {
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
    <Card sx={{ flex: "1 1 220px", minWidth: 220 }}>
      <CardContent sx={{ textAlign: "center" }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, my: 0.5, color: color ? `${color}.main` : undefined }}
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

/** One altitude band in the wind table. */
function WindRow({
  label,
  sublabel,
  speed,
  units,
}: {
  label: string;
  sublabel: string;
  speed: number | undefined;
  units: "metric" | "imperial";
}) {
  // 80 m and 120 m winds are optional in the Open-Meteo response, so "missing"
  // and "calm" must not look the same.
  if (speed === undefined) {
    return (
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", py: 1.5 }}
      >
        <Box>
          <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {sublabel}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Not reported here
        </Typography>
      </Stack>
    );
  }

  const condition = windCondition(speed);
  const display =
    units === "metric"
      ? `${Math.round(speed)} km/h`
      : `${Math.round(speed * 0.621371)} mph`;

  return (
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "space-between", py: 1.5 }}
    >
      <Box>
        <Typography sx={{ fontWeight: 500 }}>{label}</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {sublabel}
        </Typography>
      </Box>
      <Stack spacing={0.5} sx={{ alignItems: "flex-end" }}>
        <Typography sx={{ fontWeight: 600 }}>{display}</Typography>
        <Chip
          size="small"
          label={condition.text}
          color={severityColor(condition.severity)}
        />
      </Stack>
    </Stack>
  );
}

export function MountainDashboard({ coordinates }: MountainDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);
  const { data, isLoading, error, advice } = useMountainForecast(coordinates);

  const current = data?.current;

  return (
    <QueryState
      isLoading={isLoading}
      error={error}
      hasData={Boolean(current)}
      loadingLabel="Loading mountain conditions…"
      errorTitle="Could not load mountain conditions"
      incompleteMessage="The forecast came back without current conditions for this point."
    >
      {() => current && (
        <Stack spacing={3}>
          {(() => {
            const wind = windCondition(current.wind_speed_10m ?? 0);
            const visibility = visibilityCondition(current.weather_code);
            const avalanche = avalancheRisk(
              current.temperature_2m,
              current.wind_speed_10m ?? 0,
              current.weather_code,
            );

            return (
              <>
                <Alert severity={avalanche.severity === "low" ? "success" : "warning"}>
                  <AlertTitle>Avalanche risk: {avalanche.level}</AlertTitle>
                  {avalanche.description}
                </Alert>

                <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }}>
                  <StatTile
                    label="Temperature"
                    value={
                      units === "metric"
                        ? `${Math.round(current.temperature_2m)}°C`
                        : `${Math.round((current.temperature_2m * 9) / 5 + 32)}°F`
                    }
                    detail={`Feels like ${Math.round(current.temperature_2m - 2)}°`}
                  />
                  <StatTile
                    label="Wind (surface)"
                    value={
                      units === "metric"
                        ? `${Math.round(current.wind_speed_10m ?? 0)} km/h`
                        : `${Math.round((current.wind_speed_10m ?? 0) * 0.621371)} mph`
                    }
                    detail={wind.text}
                    color={severityColor(wind.severity)}
                  />
                  <StatTile
                    label="Visibility"
                    value={visibility.text}
                    detail={visibility.cause}
                    color={severityColor(visibility.severity)}
                  />
                </Stack>
              </>
            );
          })()}

          {advice && (
            <AdviceCard advice={advice} title="Preparing for the ascent" />
          )}

          <Card>
            <CardHeader
              title="Wind at altitude"
              subheader="Ridge exposure is not visible in the surface figure"
              slotProps={{ title: { variant: "h6", component: "h2" } }}
            />
            <CardContent>
              <WindRow
                label="Surface (10 m)"
                sublabel="Base conditions"
                speed={current.wind_speed_10m}
                units={units}
              />
              <WindRow
                label="Mid-altitude (80 m)"
                sublabel="Ridge conditions"
                speed={current.wind_speed_80m}
                units={units}
              />
              <WindRow
                label="High altitude (120 m)"
                sublabel="Summit conditions"
                speed={current.wind_speed_120m}
                units={units}
              />
            </CardContent>
          </Card>
        </Stack>
      )}
    </QueryState>
  );
}
