import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AirIcon from "@mui/icons-material/Air";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import GrassIcon from "@mui/icons-material/Grass";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";
import { MetricTile, type Severity } from "@/shared/ui/MetricTile";
import { RiskGauge } from "@/shared/ui/RiskGauge";
import { QueryState } from "@/shared/ui/QueryState";
import { describeQueryError } from "@/shared/lib/queryError";
import type { RiskLevel } from "@/shared/types/weather";
import type { Coordinates } from "@/shared/types/weather";
import { useGetAirQualityQuery } from "@/features/airquality/api/airQualityApi";
import {
  dominantPollutant,
  europeanAqiBand,
  pollenReadings,
  uvBand,
} from "@/features/airquality/lib/aqi";

export interface AirQualityPanelProps {
  /** WGS 84 decimal degrees. Nothing here converts it. */
  coordinates: Coordinates;
}

/**
 * The display scale as a `MetricTile` severity index.
 *
 * A total `Record` rather than `RISK_LEVELS.indexOf(...) as Severity`. The
 * lookup would be correct today, but `indexOf` returns `-1` for a miss and the
 * assertion tells the compiler to ignore exactly the case where the code is
 * wrong — yielding an undefined palette entry rather than a failure. This map
 * needs no assertion and stops compiling the moment `RiskLevel` gains a member.
 */
const SEVERITY_BY_LEVEL: Record<RiskLevel, Severity> = {
  low: 0,
  moderate: 1,
  high: 2,
  severe: 3,
};

function severityOf(level: RiskLevel): Severity {
  return SEVERITY_BY_LEVEL[level];
}

/** Micrograms per cubic metre, to the precision the model actually carries. */
function micrograms(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return value < 10 ? value.toFixed(1) : Math.round(value).toString();
}

/**
 * Air quality, UV and pollen for one coordinate.
 *
 * Composed into the general dashboard, but standalone by design — it owns its
 * own query, so a slow air quality request never blocks the forecast beside it.
 * The agriculture dashboard gates its render on two queries at once and a slow
 * soil request blanks the whole view; this deliberately does not repeat that.
 *
 * Nothing here is a prediction. Every band comes from `lib/aqi.ts`, which is
 * published thresholds and `if` branches — see CONTEXT.md.
 */
export function AirQualityPanel({ coordinates }: AirQualityPanelProps) {
  const { data, isLoading, error, refetch } = useGetAirQualityQuery(coordinates);

  const current = data?.current;

  return (
    <Card>
      <CardHeader
        title="Air quality"
        subheader="European AQI, UV and pollen"
        slotProps={{
          title: { variant: "h6", component: "h2" },
          subheader: { variant: "body2" },
        }}
      />
      <CardContent>
        <QueryState
          isLoading={isLoading}
          error={error}
          hasData={Boolean(current)}
          loadingLabel="Loading air quality…"
          errorTitle="Could not load air quality"
          errorMessage={describeQueryError(error)}
          incompleteMessage="The air quality service answered without a current reading for this location."
        >
          {() => {
            // Narrowed by `hasData` above — `QueryState`'s render prop is what
            // defers this until then.
            const reading = current!;
            const aqi = reading.european_aqi;
            const uv = reading.uv_index;
            const worst = dominantPollutant(reading);
            const pollen = pollenReadings(reading);

            const aqiBand =
              aqi !== undefined ? europeanAqiBand(aqi) : null;
            const uvReading = uv !== undefined ? uvBand(uv) : null;

            return (
              <Stack spacing={2.5}>
                {aqiBand ? (
                  <RiskGauge
                    level={aqiBand.level}
                    score={aqi}
                    label={`Air quality: ${aqiBand.label}`}
                    description={aqiBand.guidance}
                  />
                ) : (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No European AQI is published for this location.
                  </Typography>
                )}

                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(160px, 1fr))",
                  }}
                >
                  {worst && (
                    <MetricTile
                      label="Dominant pollutant"
                      value={worst.label}
                      icon={<ScienceOutlinedIcon />}
                      severity={severityOf(
                        europeanAqiBand(worst.subIndex).level,
                      )}
                      hint={`${micrograms(worst.concentration)} µg/m³ · sub-index ${Math.round(worst.subIndex)}`}
                    />
                  )}

                  {uvReading && (
                    <MetricTile
                      label="UV index"
                      value={uv!.toFixed(1)}
                      icon={<WbSunnyOutlinedIcon />}
                      severity={severityOf(uvReading.level)}
                      hint={
                        uvReading.burnMinutes !== undefined
                          ? `${uvReading.label} · fair skin burns in ~${uvReading.burnMinutes} min`
                          : `${uvReading.label} · no burn risk`
                      }
                    />
                  )}

                  {micrograms(reading.pm2_5) && (
                    <MetricTile
                      label="PM2.5"
                      value={micrograms(reading.pm2_5)}
                      unit="µg/m³"
                      icon={<BlurOnIcon />}
                      hint="Fine particles, the ones that reach the lungs"
                    />
                  )}

                  {micrograms(reading.pm10) && (
                    <MetricTile
                      label="PM10"
                      value={micrograms(reading.pm10)}
                      unit="µg/m³"
                      icon={<BlurOnIcon />}
                      hint="Coarse particles: dust, pollen, smoke"
                    />
                  )}

                  {micrograms(reading.nitrogen_dioxide) && (
                    <MetricTile
                      label="Nitrogen dioxide"
                      value={micrograms(reading.nitrogen_dioxide)}
                      unit="µg/m³"
                      icon={<AirIcon />}
                      hint="Mostly traffic"
                    />
                  )}

                  {micrograms(reading.ozone) && (
                    <MetricTile
                      label="Ozone"
                      value={micrograms(reading.ozone)}
                      unit="µg/m³"
                      icon={<AirIcon />}
                      hint="Peaks on hot, sunny afternoons"
                    />
                  )}
                </Box>

                {/*
                  Pollen is Europe-only. Outside the CAMS domain the fields come
                  back absent, `pollenReadings` returns empty, and this section
                  disappears — rather than rendering six rows of "null", which
                  reads as "no pollen" and is a different claim entirely.
                */}
                {pollen.length > 0 && (
                  <Box>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ alignItems: "center", mb: 1 }}
                    >
                      <GrassIcon aria-hidden sx={{ fontSize: 18, color: "text.secondary" }} />
                      <Typography variant="label" component="h3">
                        Pollen
                      </Typography>
                    </Stack>

                    <Stack
                      direction="row"
                      sx={{ flexWrap: "wrap", gap: 1 }}
                    >
                      {pollen.map((species) => (
                        <Chip
                          key={species.species}
                          size="small"
                          variant="outlined"
                          // The count and the band are both in the label, so
                          // the chip never depends on its colour to be read.
                          label={`${species.speciesLabel}: ${species.label} (${Math.round(species.grains)} grains/m³)`}
                          sx={(theme) => ({
                            borderColor: theme.vars.palette.risk[species.level].border,
                            backgroundColor: theme.vars.palette.risk[species.level].soft,
                            color: theme.vars.palette.risk[species.level].text,
                          })}
                        />
                      ))}
                    </Stack>

                    {pollen[0].band !== "none" && (
                      <Typography
                        variant="body2"
                        sx={{ color: "text.secondary", mt: 1 }}
                      >
                        {pollen[0].speciesLabel} is highest. {pollen[0].guidance}
                      </Typography>
                    )}
                  </Box>
                )}

                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Bands are the published European AQI, WHO UV and Met Office
                  pollen scales, applied by fixed rules — not a prediction.{" "}
                  <Box
                    component="button"
                    type="button"
                    onClick={() => refetch()}
                    sx={{
                      border: 0,
                      p: 0,
                      background: "none",
                      font: "inherit",
                      color: "primary.main",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Refresh
                  </Box>
                </Typography>
              </Stack>
            );
          }}
        </QueryState>
      </CardContent>
    </Card>
  );
}
