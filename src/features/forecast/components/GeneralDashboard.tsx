import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { WeatherCard } from "@/shared/ui/WeatherCard";
import { AdviceCard } from "@/shared/ui/AdviceCard";
import { QueryState } from "@/shared/ui/QueryState";
import { useAppSelector } from "@/store/hooks";
import { useGeneralForecast } from "@/features/forecast/hooks/useGeneralForecast";
import type { Coordinates } from "@/shared/types/weather";

interface GeneralDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

function formatHour(iso: string) {
  const hour = new Date(iso).getHours();
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function GeneralDashboard({
  coordinates,
  locationName,
}: GeneralDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);
  const { data, isLoading, error, advice } = useGeneralForecast(coordinates);

  const current = data?.current;
  const hourly = data?.hourly;
  const daily = data?.daily;

  return (
    <QueryState
      isLoading={isLoading}
      error={error}
      hasData={Boolean(current && hourly && daily)}
      loadingLabel="Loading your forecast…"
      errorTitle="Could not load the forecast"
    >
      {() => (
      <Stack spacing={3}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <WeatherCard
            weather={current!}
            location={locationName}
            profile="general"
            units={units}
          />
        </Box>

        {advice && <AdviceCard advice={advice} title="How to dress today" />}

        <Card>
          <CardHeader
            title="Next 24 hours"
            slotProps={{ title: { variant: "h6", component: "h2" } }}
          />
          <CardContent>
            <Stack
              direction="row"
              spacing={3}
              sx={{ overflowX: "auto", pb: 2 }}
            >
              {hourly!.time.slice(0, 24).map((time, index) => {
                const temp = hourly!.temperature_2m[index];
                const precipitation = hourly!.precipitation[index];

                return (
                  <Box
                    key={time}
                    sx={{ flexShrink: 0, textAlign: "center", minWidth: 80 }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      {formatHour(time)}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {Math.round(temp)}°
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      // 10 mm in an hour is torrential; anything at or above it
                      // pins the bar rather than overflowing.
                      value={Math.min(precipitation * 10, 100)}
                      sx={{ my: 0.5, borderRadius: 1 }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      {precipitation.toFixed(1)}mm
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Next 7 days"
            slotProps={{ title: { variant: "h6", component: "h2" } }}
          />
          <CardContent>
            <Stack divider={<Divider flexItem />}>
              {daily!.time.map((date, index) => {
                const maxTemp = daily!.temperature_2m_max[index];
                const minTemp = daily!.temperature_2m_min[index];
                const precipitation = daily!.precipitation_sum[index];

                return (
                  <Stack
                    key={date}
                    direction="row"
                    sx={{ alignItems: "center", py: 1.5 }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 500 }}>
                        {new Date(date).toLocaleDateString([], {
                          weekday: "short",
                        })}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary" }}
                      >
                        {new Date(date).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </Typography>
                    </Box>

                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ flex: 1, justifyContent: "center" }}
                    >
                      <Typography sx={{ fontWeight: 600 }}>
                        {Math.round(maxTemp)}°
                      </Typography>
                      <Typography sx={{ color: "text.secondary" }}>
                        {Math.round(minTemp)}°
                      </Typography>
                    </Stack>

                    <Typography variant="body2" sx={{ flex: 1, textAlign: "right" }}>
                      {precipitation > 0
                        ? `${precipitation.toFixed(1)}mm`
                        : "No rain"}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
      )}
    </QueryState>
  );
}
