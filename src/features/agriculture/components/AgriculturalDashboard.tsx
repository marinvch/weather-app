import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { AdviceCard } from "@/shared/ui/AdviceCard";
import { DashboardShell } from "@/shared/ui/DashboardShell";
import { HeroConditions } from "@/shared/ui/HeroConditions";
import { formatSpeed, formatTemperature, unitsFor } from "@/shared/lib/units";
import type { Coordinates } from "@/shared/types/weather";
import { useAppSelector } from "@/store/hooks";
import { useAgronomicData } from "@/features/agriculture/hooks/useAgronomicData";
import { accumulateGdd } from "@/features/agriculture/lib/gdd";
import { DegreeDayCard } from "@/features/agriculture/components/DegreeDayCard";
import { GrowingTiles } from "@/features/agriculture/components/GrowingTiles";
import { RiverSection } from "@/features/agriculture/components/RiverSection";
import { SoilProfileSection } from "@/features/agriculture/components/SoilProfileSection";
import { SprayWindowCard } from "@/features/agriculture/components/SprayWindowCard";

interface AgriculturalDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

/**
 * The grower's lens: soil, frost, degree-days, the spray window and the river.
 *
 * Composition only. Every classification lives in `lib/`, and each section that
 * needs data the agronomic query does not carry — the soil profile, the river —
 * owns its own query and its own loading state. **The view is gated on one
 * query, not on all of them**: the old dashboard awaited the soil request
 * alongside the agronomic one, so a slow soil response blanked the frost
 * warning too.
 */
export function AgriculturalDashboard({
  coordinates,
  locationName,
}: AgriculturalDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);
  const unitSet = unitsFor(units);

  const { data, isLoading, isError, error, refetch, advice } =
    useAgronomicData(coordinates);

  const current = data?.current;
  const gdd = accumulateGdd(data?.daily, { base: 10 });

  return (
    <DashboardShell
      title="Growing conditions"
      subtitle="Soil, frost, degree-days and the spray window"
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
          <>
            <HeroConditions
              locationName={locationName}
              temperature={current.temperature_2m}
              weatherCode={current.weather_code}
              isDay={Boolean(current.is_day)}
              temperatureUnit={unitSet.temperature}
              high={data?.daily?.temperature_2m_max?.[0]}
              low={data?.daily?.temperature_2m_min?.[0]}
              observedAt={current.time}
              secondary={
                <Typography variant="body2">
                  Soil{" "}
                  {formatTemperature(
                    current.soil_temperature_0cm,
                    unitSet.temperature,
                  )}{" "}
                  · {current.relative_humidity_2m}% RH ·{" "}
                  {formatSpeed(current.wind_speed_10m, unitSet.speed)}
                </Typography>
              }
            />

            <GrowingTiles
              current={current}
              et0Mm={data?.daily?.et0_fao_evapotranspiration?.[0]}
              gdd={gdd}
              unitSet={unitSet}
            />

            <SprayWindowCard
              now={{
                windSpeedKmh: current.wind_speed_10m,
                // Current conditions carry no probability of precipitation, so
                // the nearest hour's is used. Absent, the assessment says so
                // rather than assuming dry.
                precipitationProbability:
                  data?.hourly?.precipitation_probability?.[0],
                relativeHumidity: current.relative_humidity_2m,
                temperatureC: current.temperature_2m,
              }}
              hourly={data?.hourly}
            />
          </>
        )}

        <DegreeDayCard accumulation={gdd} />

        <SoilProfileSection coordinates={coordinates} />
        <RiverSection coordinates={coordinates} />

        {advice && <AdviceCard advice={advice} title="Growing advice" />}
      </Stack>
    </DashboardShell>
  );
}
