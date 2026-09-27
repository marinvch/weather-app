import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AdviceCard } from "@/shared/ui/AdviceCard";
import { DashboardShell } from "@/shared/ui/DashboardShell";
import { HeroConditions } from "@/shared/ui/HeroConditions";
import { RiskGauge } from "@/shared/ui/RiskGauge";
import { degreesToCardinal, formatSpeed, unitsFor } from "@/shared/lib/units";
import type { Coordinates } from "@/shared/types/weather";
import { useAppSelector } from "@/store/hooks";
import { useMountainForecast } from "@/features/mountain/hooks/useMountainForecast";
import {
  atCurrentHour,
  avalancheReading,
  freezingLevelReading,
  riskLevelFromSeverity,
  snowDepthReading,
  windChill,
  windChillApplies,
} from "@/features/mountain/lib/conditions";
import { AltitudeTiles } from "@/features/mountain/components/AltitudeTiles";
import { AscentWindProfileCard } from "@/features/mountain/components/AscentWindProfileCard";

interface MountainDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

/**
 * The mountaineer's lens: how high the ground is, where the freezing level
 * sits, how much more wind the ridge gets than the valley, and how long
 * exposed skin lasts in it.
 *
 * Composition only. Loading, failure and the empty payload belong to
 * `DashboardShell`; every classification belongs to `lib/conditions`.
 */
export function MountainDashboard({
  coordinates,
  locationName,
}: MountainDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);
  const unitSet = unitsFor(units);

  const { data, isLoading, isError, error, refetch, advice } =
    useMountainForecast(coordinates);

  const current = data?.current;

  // NaN when there is no payload. The shell renders its empty state instead of
  // the children, so these are only read on the ready path.
  const temp = current?.temperature_2m ?? Number.NaN;
  const surfaceWind = current?.wind_speed_10m ?? Number.NaN;

  const chill = windChill(temp, surfaceWind);
  const chillApplies = windChillApplies(temp, surfaceWind);
  const avalanche = avalancheReading(temp, surfaceWind, current?.weather_code ?? 0);

  const freezing = freezingLevelReading(
    atCurrentHour(data?.hourly?.freezing_level_height),
    data?.elevation,
  );
  const snow = snowDepthReading(atCurrentHour(data?.hourly?.snow_depth));

  return (
    <DashboardShell
      title="Mountain conditions"
      subtitle={
        data?.elevation != null
          ? `Model terrain at ${Math.round(data.elevation)} m above sea level`
          : "Ascent planning — wind at altitude, freezing level, snowpack"
      }
      locationName={locationName}
      coordinates={coordinates}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={!current}
      onRetry={() => void refetch()}
    >
      <Stack spacing={3}>
        {current && (
          <HeroConditions
            locationName={locationName}
            temperature={current.temperature_2m}
            apparentTemperature={
              chillApplies ? chill : current.apparent_temperature
            }
            weatherCode={current.weather_code}
            isDay={Boolean(current.is_day)}
            temperatureUnit={unitSet.temperature}
            observedAt={current.time}
            secondary={
              <Typography variant="body2">
                {formatSpeed(surfaceWind, unitSet.speed)} from the{" "}
                {degreesToCardinal(current.wind_direction_10m)}
                {data?.elevation != null && ` · ${Math.round(data.elevation)} m`}
              </Typography>
            }
          />
        )}

        <RiskGauge
          level={riskLevelFromSeverity(avalanche.severity)}
          label={`Avalanche risk: ${avalanche.level}`}
          description={`${avalanche.description}. This is a points-based reading from temperature, wind and precipitation — it is not an official avalanche bulletin, and it does not know the aspect or the slope angle of your route.`}
        />

        <AltitudeTiles
          elevationMetres={data?.elevation}
          temperatureC={temp}
          windKmh={surfaceWind}
          weatherCode={current?.weather_code ?? 0}
          freezing={freezing}
          snow={snow}
          unitSet={unitSet}
        />

        <AscentWindProfileCard current={current ?? {}} unitSet={unitSet} />

        {freezing && (
          <Card>
            <CardHeader
              title="Freezing level and snowpack"
              slotProps={{ title: { variant: "h6", component: "h2" } }}
            />
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="body2">
                  0°C isotherm at {Math.round(freezing.heightMetres)} m —{" "}
                  {freezing.text}.
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {freezing.advice}
                </Typography>
                {snow && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {Math.round(snow.centimetres)} cm lying — {snow.advice}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}

        {advice && (
          <AdviceCard advice={advice} title="Preparing for the ascent" />
        )}
      </Stack>
    </DashboardShell>
  );
}
