import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import AirIcon from "@mui/icons-material/Air";
import PlaceIcon from "@mui/icons-material/Place";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import { MetricTile } from "@/shared/ui/MetricTile";
import {
  convertSpeed,
  degreesToCardinal,
  formatSpeed,
  formatTemperature,
  type UnitSet,
} from "@/shared/lib/units";
import type { Coordinates, CurrentWeather } from "@/shared/types/weather";
import { beaufortFromKmh, tileSeverity } from "@/features/marine/lib/seaState";

/**
 * Offered when the marine model has no coverage for the selected point. Every
 * coordinate has to sit on open water, or the suggestion leads straight back to
 * the same empty state.
 */
const SUGGESTED_LOCATIONS: { name: string; coords: Coordinates }[] = [
  { name: "Santander, Spain", coords: { latitude: 43.48, longitude: -3.8 } },
  { name: "Baltic Sea, Germany", coords: { latitude: 54.5445, longitude: 10.2275 } },
  { name: "Gibraltar, Mediterranean", coords: { latitude: 36.1408, longitude: -5.3536 } },
  { name: "Miami Beach, FL", coords: { latitude: 25.7907, longitude: -80.12 } },
];

export interface CoastalFallbackProps {
  air: CurrentWeather | undefined;
  unitSet: UnitSet;
  onSelectLocation: (name: string, coords: Coordinates) => void;
}

/**
 * What an inland user gets instead of a sea state: somewhere to go, and the
 * shore-side readings that do apply.
 *
 * Rendered beside `DashboardShell` rather than inside it, so it survives the
 * shell's empty state — which is exactly the moment it is needed. The shell
 * says honestly that there is no marine data here; this says what to do next.
 */
export function CoastalFallback({
  air,
  unitSet,
  onSelectLocation,
}: CoastalFallbackProps) {
  const wind = beaufortFromKmh(air?.wind_speed_10m ?? null);

  return (
    <Card>
      <CardHeader
        title="Try a coastal location"
        subheader="The marine model only covers open water"
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
            {SUGGESTED_LOCATIONS.map((location) => (
              <Button
                key={location.name}
                size="small"
                variant="outlined"
                startIcon={<PlaceIcon />}
                onClick={() => onSelectLocation(location.name, location.coords)}
              >
                {location.name}
              </Button>
            ))}
          </Stack>

          {air && (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              }}
            >
              <MetricTile
                label="Air temperature"
                value={formatTemperature(air.temperature_2m, unitSet.temperature, {
                  showScale: false,
                })}
                unit={unitSet.temperature === "f" ? "°F" : "°C"}
                icon={<ThermostatIcon />}
                hint="On shore"
              />
              <MetricTile
                label="Wind"
                value={convertSpeed(air.wind_speed_10m, "kn").toFixed(0)}
                unit="kn"
                icon={<AirIcon />}
                severity={tileSeverity(wind?.risk)}
                hint={`${formatSpeed(air.wind_speed_10m, "ms")} · from ${degreesToCardinal(air.wind_direction_10m)}`}
              />
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
