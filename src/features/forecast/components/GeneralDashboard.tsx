import { useMemo } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AirIcon from "@mui/icons-material/Air";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import UmbrellaOutlinedIcon from "@mui/icons-material/UmbrellaOutlined";
import WaterDropOutlinedIcon from "@mui/icons-material/WaterDropOutlined";

import { AdviceCard } from "@/shared/ui/AdviceCard";
import { DashboardShell } from "@/shared/ui/DashboardShell";
import { HeroConditions } from "@/shared/ui/HeroConditions";
import { MetricTile, type Severity } from "@/shared/ui/MetricTile";
import { WeatherChart } from "@/shared/ui/WeatherChart";
import { conditionFromCode } from "@/shared/theme/conditions";
import {
  degreesToCardinal,
  formatPrecip,
  formatSpeed,
  formatTemperature,
  unitsFor,
} from "@/shared/lib/units";
import {
  riskLevelFromAnalysis,
  type AIAnalysis,
  type Coordinates,
  type HourlyWeather,
  type RiskLevel,
} from "@/shared/types/weather";
import { useAppSelector } from "@/store/hooks";
import { useGeneralForecast } from "@/features/forecast/hooks/useGeneralForecast";
import { DaylightStrip } from "@/features/forecast/components/DaylightStrip";
import {
  daylightForDay,
  daylightProgress,
  localMinutesNow,
} from "@/features/forecast/lib/astronomy";

export interface GeneralDashboardProps {
  coordinates: Coordinates;
  /** Display-only, but the header expects it beside the coordinate. */
  locationName: string;
}

/** Hours of the hourly series to chart. Two days is enough to see a front
 * arrive without the x-axis becoming a smear. */
const CHART_HOURS = 48;

/**
 * The display scale as a `MetricTile` severity index.
 *
 * A total `Record` rather than `RISK_LEVELS.indexOf(...) as Severity`. The
 * lookup would be correct today, but `indexOf` returns `-1` for a miss and the
 * assertion tells the compiler to ignore exactly the case where the code is
 * wrong — yielding an undefined palette entry rather than a failure. This map
 * needs no assertion and stops compiling the moment `RiskLevel` gains a member,
 * which is when someone wants to be told: `RISK_LEVELS` is built to be extended,
 * and "severe" is already documented as unreachable from an Analysis today.
 */
const SEVERITY_BY_LEVEL: Record<RiskLevel, Severity> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
};

/**
 * The advice scale is three-step and the palette's is four.
 * `riskLevelFromAnalysis` is the one sanctioned crossing; a cast instead yields
 * "medium", which matches no key in the `risk` palette and renders undefined
 * colours rather than failing.
 */
function severityFromAnalysis(level: AIAnalysis["riskLevel"]): Severity {
  return SEVERITY_BY_LEVEL[riskLevelFromAnalysis(level)];
}

/**
 * The General Public dashboard — "how should I dress today".
 *
 * Rebuilt on `DashboardShell` + `HeroConditions` + `MetricTile`, which is where
 * the loading skeleton, the actionable error and the empty state come from. The
 * hand-rolled versions of those three states were most of why the four
 * dashboards ran to ~1180 lines between them.
 *
 * Every figure respects `state.userProfile.units`. The values held here are
 * metric, always — conversion is a display step and happens only inside
 * `@/shared/lib/units`, never before a threshold comparison.
 */
export function GeneralDashboard({
  coordinates,
  locationName,
}: GeneralDashboardProps) {
  const unitSystem = useAppSelector((state) => state.userProfile.units);
  const showCharts = useAppSelector((state) => state.preferences.showCharts);
  const units = unitsFor(unitSystem);

  const { data, isLoading, isError, error, refetch, advice } =
    useGeneralForecast(coordinates);

  const current = data?.current;
  const hourly = data?.hourly;
  const daily = data?.daily;

  const today = useMemo(() => daylightForDay(daily, 0), [daily]);

  // "Now" at the coordinate, not on the viewer's clock — `utc_offset_seconds`
  // comes back with every `timezone: "auto"` response precisely so this is
  // possible for a place you are not standing in.
  const nowMinutes = useMemo(
    () => localMinutesNow(data?.utc_offset_seconds ?? 0),
    [data?.utc_offset_seconds],
  );

  const progress = useMemo(() => {
    const sunrise = daily?.sunrise?.[0];
    const sunset = daily?.sunset?.[0];
    if (!sunrise || !sunset) return null;
    return daylightProgress(nowMinutes, sunrise, sunset);
  }, [daily, nowMinutes]);

  /**
   * The chart window, starting at the current local hour rather than at
   * midnight. `hourly.time[0]` is local midnight of day one, so the index of
   * "now" is simply the hour of the local day.
   */
  const chartHours = useMemo<HourlyWeather | null>(() => {
    if (!hourly) return null;

    const start = Math.min(
      Math.floor(nowMinutes / 60),
      Math.max(0, hourly.time.length - CHART_HOURS),
    );
    const end = start + CHART_HOURS;
    const slice = <T,>(series: T[] | undefined) => series?.slice(start, end);

    return {
      time: hourly.time.slice(start, end),
      temperature_2m: slice(hourly.temperature_2m) ?? [],
      precipitation_probability: slice(hourly.precipitation_probability) ?? [],
      precipitation: slice(hourly.precipitation) ?? [],
      wind_speed_10m: slice(hourly.wind_speed_10m) ?? [],
      wind_direction_10m: slice(hourly.wind_direction_10m) ?? [],
      relative_humidity_2m: slice(hourly.relative_humidity_2m) ?? [],
      weather_code: slice(hourly.weather_code) ?? [],
      cloud_cover: slice(hourly.cloud_cover),
    };
  }, [hourly, nowMinutes]);

  const isEmpty = Boolean(data) && !(current && hourly && daily);

  return (
    <DashboardShell
      title="Today"
      subtitle="What to wear, and whether to take a coat"
      locationName={locationName}
      coordinates={coordinates}
      isLoading={isLoading}
      isError={isError}
      error={error}
      isEmpty={isEmpty}
      onRetry={refetch}
    >
      {current && hourly && daily && (
        <Stack spacing={3}>
          <HeroConditions
            locationName={locationName}
            temperature={current.temperature_2m}
            apparentTemperature={current.apparent_temperature}
            weatherCode={current.weather_code}
            isDay={Boolean(current.is_day)}
            temperatureUnit={units.temperature}
            high={daily.temperature_2m_max?.[0]}
            low={daily.temperature_2m_min?.[0]}
            observedAt={current.time}
            secondary={
              <>
                <Typography variant="body2">
                  {formatSpeed(current.wind_speed_10m, units.speed)}{" "}
                  {degreesToCardinal(current.wind_direction_10m)}
                </Typography>
                <Typography variant="body2">
                  {Math.round(current.relative_humidity_2m)}% humidity
                </Typography>
                {today?.sunset && (
                  <Typography variant="body2">
                    Sunset {today.sunset}
                  </Typography>
                )}
              </>
            }
          />

          {advice && <AdviceCard advice={advice} title="How to dress today" />}

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            }}
          >
            {current.apparent_temperature !== undefined && (
              <MetricTile
                label="Feels like"
                value={formatTemperature(
                  current.apparent_temperature,
                  units.temperature,
                )}
                icon={<ThermostatIcon />}
                hint={
                  // The gap is the point: 6 °C of wind chill is the difference
                  // between a jacket and a coat, and the dry-bulb figure alone
                  // never says so.
                  Math.abs(
                    current.apparent_temperature - current.temperature_2m,
                  ) >= 2
                    ? `${
                        current.apparent_temperature < current.temperature_2m
                          ? "Colder"
                          : "Warmer"
                      } than the thermometer says`
                    : "Close to the measured temperature"
                }
              />
            )}

            <MetricTile
              label="Wind"
              value={formatSpeed(current.wind_speed_10m, units.speed)}
              icon={<AirIcon />}
              hint={`From the ${degreesToCardinal(current.wind_direction_10m)}`}
              severity={current.wind_speed_10m > 40 ? 2 : current.wind_speed_10m > 20 ? 1 : 0}
            />

            <MetricTile
              label="Humidity"
              value={Math.round(current.relative_humidity_2m)}
              unit="%"
              icon={<WaterDropOutlinedIcon />}
            />

            <MetricTile
              label="Rain now"
              value={formatPrecip(current.precipitation ?? 0, units.precipitation)}
              icon={<UmbrellaOutlinedIcon />}
              hint={`${Math.round(hourly.precipitation_probability?.[0] ?? 0)}% chance this hour`}
            />

            {current.cloud_cover !== undefined && (
              <MetricTile
                label="Cloud cover"
                value={Math.round(current.cloud_cover)}
                unit="%"
                icon={<CloudOutlinedIcon />}
                hint={conditionFromCode(current.weather_code).label}
              />
            )}

            {advice && (
              <MetricTile
                label="Conditions"
                value={riskLevelFromAnalysis(advice.riskLevel)}
                icon={<ExploreOutlinedIcon />}
                severity={severityFromAnalysis(advice.riskLevel)}
                hint="Rule-based, not a forecast model"
              />
            )}
          </Box>

          {today && <DaylightStrip day={today} progress={progress} />}

          {showCharts && chartHours && chartHours.time.length > 0 && (
            <WeatherChart
              data={chartHours}
              type="precipitation"
              title="Rain and chance of rain, next 48 hours"
            />
          )}

          <Card>
            <CardHeader
              title="Next 7 days"
              slotProps={{ title: { variant: "h6", component: "h2" } }}
            />
            <CardContent>
              <Stack divider={<Divider flexItem />}>
                {daily.time.map((date, index) => {
                  const maxTemp = daily.temperature_2m_max[index];
                  const minTemp = daily.temperature_2m_min[index];
                  const precipitation = daily.precipitation_sum[index];
                  const condition = conditionFromCode(daily.weather_code[index]);

                  return (
                    <Stack
                      key={date}
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", py: 1.5 }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
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

                      <Typography
                        variant="body2"
                        sx={{
                          flex: 1.4,
                          minWidth: 0,
                          color: "text.secondary",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {condition.label}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flex: 1, justifyContent: "flex-end" }}
                      >
                        <Typography sx={{ fontWeight: 600 }}>
                          {formatTemperature(maxTemp, units.temperature, {
                            showScale: false,
                          })}
                        </Typography>
                        <Typography sx={{ color: "text.secondary" }}>
                          {formatTemperature(minTemp, units.temperature, {
                            showScale: false,
                          })}
                        </Typography>
                      </Stack>

                      <Typography
                        variant="body2"
                        sx={{ flex: 0.9, textAlign: "right" }}
                      >
                        {precipitation > 0
                          ? formatPrecip(precipitation, units.precipitation)
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
    </DashboardShell>
  );
}
