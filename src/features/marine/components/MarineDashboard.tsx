import { useState } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MapIcon from "@mui/icons-material/Map";
import PlaceIcon from "@mui/icons-material/Place";
import { AdviceCard } from "@/shared/ui/AdviceCard";
import { QueryState } from "@/shared/ui/QueryState";
import { WeatherMap } from "@/shared/ui/WeatherMap";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setLocation, setLocationName } from "@/store/slices/userProfileSlice";
import { useGetBasicForecastQuery } from "@/shared/api/openMeteoApi";
import { useMarineConditions } from "@/features/marine/hooks/useMarineConditions";
import {
  directionText,
  seaCondition,
  seaSeverityColor,
} from "@/features/marine/lib/seaState";
import type { Coordinates } from "@/shared/types/weather";

interface MarineDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

/**
 * Offered when the marine API has no coverage for the selected point. An inland
 * user needs somewhere to go, not just an error. Every coordinate must sit on
 * open water, or the suggestion leads back to this same empty state.
 */
const SUGGESTED_LOCATIONS = [
  { name: "Santander, Spain", coords: { latitude: 43.48, longitude: -3.8 } },
  { name: "Baltic Sea, Germany", coords: { latitude: 54.5445, longitude: 10.2275 } },
  { name: "Gibraltar, Mediterranean", coords: { latitude: 36.1408, longitude: -5.3536 } },
  { name: "Miami Beach, FL", coords: { latitude: 25.7907, longitude: -80.12 } },
];

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

export function MarineDashboard({
  coordinates,
  locationName,
}: MarineDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);
  const dispatch = useAppDispatch();
  const [showMap, setShowMap] = useState(false);

  const {
    data: marineData,
    isLoading: marineLoading,
    error: marineError,
    advice,
  } = useMarineConditions(coordinates);

  // The plain forecast too: wind and air temperature matter to a boat even
  // where there is no wave data.
  const {
    data: weatherData,
    isLoading: weatherLoading,
    error: weatherError,
  } = useGetBasicForecastQuery(coordinates);

  const selectLocation = (name: string, coords: Coordinates) => {
    dispatch(setLocation(coords));
    dispatch(setLocationName(name));
  };

  const mapToggle = (
    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={<MapIcon />}
        onClick={() => setShowMap((open) => !open)}
      >
        {showMap ? "Hide map" : "Show map"}
      </Button>
    </Stack>
  );

  const map = showMap && (
    <WeatherMap
      coordinates={coordinates}
      locationName={locationName}
      onLocationSelect={(coords, name) => selectLocation(name, coords)}
    />
  );

  // Both sources failed — nothing to show at all.
  if (
    (marineError || !marineData) &&
    (weatherError || !weatherData) &&
    !marineLoading &&
    !weatherLoading
  ) {
    return (
      <QueryState
        isLoading={false}
        error={weatherError ?? marineError}
        hasData={false}
        loadingLabel=""
        errorTitle="Could not load conditions"
      >
        {() => null}
      </QueryState>
    );
  }

  // Marine data unavailable but the forecast arrived: this is an inland point,
  // or one the marine model does not cover.
  if ((marineError || !marineData) && weatherData && !marineLoading) {
    return (
      <Stack spacing={3}>
        <Alert severity="info">
          <AlertTitle>No marine data for {locationName}</AlertTitle>
          This point is inland, or outside the marine model's coverage. The wind
          and air readings below still apply.
        </Alert>

        <Card>
          <CardHeader
            title="Try a coastal location"
            slotProps={{ title: { variant: "h6", component: "h2" } }}
          />
          <CardContent>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
              {SUGGESTED_LOCATIONS.map((location) => (
                <Button
                  key={location.name}
                  size="small"
                  variant="outlined"
                  startIcon={<PlaceIcon />}
                  onClick={() => selectLocation(location.name, location.coords)}
                >
                  {location.name}
                </Button>
              ))}
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mt: 2 }}
            >
              Or pick any coastal point on the map.
            </Typography>
          </CardContent>
        </Card>

        {mapToggle}
        {map}

        {weatherData.current && (
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
            <StatTile
              label="Air temperature"
              value={
                units === "metric"
                  ? `${Math.round(weatherData.current.temperature_2m)}°C`
                  : `${Math.round((weatherData.current.temperature_2m * 9) / 5 + 32)}°F`
              }
              detail="On shore"
            />
            <StatTile
              label="Wind"
              value={
                units === "metric"
                  ? `${Math.round(weatherData.current.wind_speed_10m)} km/h`
                  : `${Math.round(weatherData.current.wind_speed_10m * 0.621371)} mph`
              }
              detail={directionText(weatherData.current.wind_direction_10m)}
            />
            <StatTile
              label="Light"
              value={weatherData.current.is_day ? "Daylight" : "Night"}
              detail={
                (weatherData.current.cloud_cover ?? 0) > 80
                  ? "Overcast"
                  : "Clear enough"
              }
            />
          </Stack>
        )}
      </Stack>
    );
  }

  const hourly = marineData?.hourly;
  // The API returns a series starting at midnight local time, so the current
  // hour indexes into it directly.
  const index = hourly
    ? Math.min(new Date().getHours(), hourly.time.length - 1)
    : 0;

  const waveHeight = hourly?.wave_height[index] ?? null;
  const sea = seaCondition(waveHeight);

  return (
    <QueryState
      isLoading={marineLoading || weatherLoading}
      error={marineError}
      hasData={Boolean(hourly)}
      loadingLabel="Loading sea conditions…"
      errorTitle="Could not load sea conditions"
    >
      {() => hourly && (
        <Stack spacing={3}>
          {mapToggle}
          {map}

          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
            <StatTile
              label="Wave height"
              value={waveHeight != null ? `${waveHeight.toFixed(1)} m` : "N/A"}
              detail={sea.text}
              color={seaSeverityColor(sea.severity)}
            />
            <StatTile
              label="Wave direction"
              value={
                hourly.wave_direction[index] != null
                  ? directionText(hourly.wave_direction[index])
                  : "N/A"
              }
              detail={
                hourly.wave_direction[index] != null
                  ? `${Math.round(hourly.wave_direction[index])}°`
                  : "No data"
              }
            />
            <StatTile
              label="Sea temperature"
              value={
                hourly.sea_surface_temperature[index] != null
                  ? units === "metric"
                    ? `${Math.round(hourly.sea_surface_temperature[index])}°C`
                    : `${Math.round((hourly.sea_surface_temperature[index] * 9) / 5 + 32)}°F`
                  : "N/A"
              }
              detail="Surface"
            />
            <StatTile
              label="Wave period"
              value={
                hourly.wave_period[index] != null
                  ? `${hourly.wave_period[index].toFixed(1)} s`
                  : "N/A"
              }
              detail="Between crests"
            />
          </Stack>

          {advice && <AdviceCard advice={advice} title="Is it worth going out" />}

          <Card>
            <CardHeader
              title="Current and swell"
              slotProps={{ title: { variant: "h6", component: "h2" } }}
            />
            <CardContent>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
                <Box sx={{ flex: "1 1 200px" }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Ocean current
                  </Typography>
                  <Typography sx={{ fontWeight: 600 }}>
                    {hourly.ocean_current_velocity[index] != null
                      ? `${hourly.ocean_current_velocity[index].toFixed(1)} km/h ${
                          hourly.ocean_current_direction[index] != null
                            ? directionText(hourly.ocean_current_direction[index])
                            : ""
                        }`
                      : "No data"}
                  </Typography>
                </Box>
                <Box sx={{ flex: "1 1 200px" }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Swell height
                  </Typography>
                  <Typography sx={{ fontWeight: 600 }}>
                    {hourly.swell_wave_height[index] != null
                      ? `${hourly.swell_wave_height[index].toFixed(1)} m`
                      : "No data"}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      )}
    </QueryState>
  );
}
