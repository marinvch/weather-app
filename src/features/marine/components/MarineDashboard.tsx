import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AdviceCard } from "@/shared/ui/AdviceCard";
import { DashboardShell } from "@/shared/ui/DashboardShell";
import { HeroConditions } from "@/shared/ui/HeroConditions";
import { RiskGauge } from "@/shared/ui/RiskGauge";
import { useGetBasicForecastQuery } from "@/shared/api/openMeteoApi";
import { degreesToCardinal, formatSpeed, unitsFor } from "@/shared/lib/units";
import type { Coordinates } from "@/shared/types/weather";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setLocation, setLocationName } from "@/store/slices/userProfileSlice";
import { useMarineConditions } from "@/features/marine/hooks/useMarineConditions";
import { currentHourIndex, readingsAt } from "@/features/marine/lib/readings";
import {
  beaufortFromKmh,
  douglasFromWaveHeight,
} from "@/features/marine/lib/seaState";
import { CoastalFallback } from "@/features/marine/components/CoastalFallback";
import { SeaStateTiles } from "@/features/marine/components/SeaStateTiles";
import { SwellSplitCard } from "@/features/marine/components/SwellSplitCard";

interface MarineDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

/**
 * The mariner's lens: Douglas sea state, Beaufort wind force, and whether the
 * sea the model reports is the sea you would actually go out in.
 *
 * Composition only. The loading, failed and empty states belong to
 * `DashboardShell`; the readings belong to `lib/seaState` and `lib/readings`;
 * each block of tiles is its own component. Nothing here classifies anything.
 */
export function MarineDashboard({
  coordinates,
  locationName,
}: MarineDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);
  const unitSet = unitsFor(units);
  const dispatch = useAppDispatch();

  // The ordinary forecast too. The marine host reports no wind at all, and wind
  // is half of what decides whether a small boat goes out — so this is not a
  // nice-to-have alongside the sea state, it is the other half of the advice.
  const forecast = useGetBasicForecastQuery(coordinates);
  const air = forecast.data?.current;

  const marine = useMarineConditions(coordinates, {
    windSpeedKmh: air?.wind_speed_10m ?? null,
    windDirectionDegrees: air?.wind_direction_10m ?? null,
  });

  const readings = readingsAt(
    marine.data,
    currentHourIndex(marine.data?.hourly?.time?.length ?? 0),
  );
  const sea = douglasFromWaveHeight(readings.waveHeight);
  const wind = beaufortFromKmh(air?.wind_speed_10m ?? null);

  // Still needed after the map moved to the app shell: the coastal-location
  // shortcuts below are the other caller, and they are the whole point of the
  // inland empty state.
  const selectLocation = (name: string, coords: Coordinates) => {
    dispatch(setLocation(coords));
    dispatch(setLocationName(name));
  };

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <DashboardShell
        title="Sea state"
        subtitle="Douglas sea state and Beaufort wind force, from the marine model"
        locationName={locationName}
        coordinates={coordinates}
        isLoading={marine.isLoading || forecast.isLoading}
        isError={marine.isError}
        error={marine.error}
        // A 200 with a full series of nulls is what an inland coordinate gets,
        // so a present response is not the same question as usable data.
        isEmpty={!marine.hasData}
        onRetry={() => {
          void marine.refetch();
          void forecast.refetch();
        }}
      >
        <Stack spacing={3}>
          {air && (
            <HeroConditions
              locationName={locationName}
              temperature={air.temperature_2m}
              weatherCode={air.weather_code}
              isDay={Boolean(air.is_day)}
              temperatureUnit={unitSet.temperature}
              observedAt={air.time}
              secondary={
                <Typography variant="body2">
                  {wind
                    ? `Force ${wind.force} ${wind.label.toLowerCase()} · ${formatSpeed(air.wind_speed_10m, "kn")} · ${degreesToCardinal(air.wind_direction_10m)}`
                    : "Wind not reported"}
                </Typography>
              }
            />
          )}

          {sea && (
            <RiskGauge
              level={sea.risk}
              label={`${sea.label} — Douglas ${sea.degree}`}
              description={sea.description}
            />
          )}

          <SeaStateTiles readings={readings} air={air} unitSet={unitSet} />

          <SwellSplitCard
            swellHeight={readings.swellHeight}
            windWaveHeight={readings.windWaveHeight}
          />

          {marine.advice && (
            <AdviceCard advice={marine.advice} title="Is it worth going out" />
          )}
        </Stack>
      </DashboardShell>

      {!marine.isLoading && !marine.hasData && (
        <CoastalFallback
          air={air}
          unitSet={unitSet}
          onSelectLocation={selectLocation}
        />
      )}
    </Stack>
  );
}
