import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { conditionFromCode, skyGradient } from "@/shared/theme/conditions";
import { formatTemperature, type TemperatureUnit } from "@/shared/lib/units";

export interface HeroConditionsProps {
  /** Display-only, and always paired with a coordinate by the caller. */
  locationName: string;
  /** **Celsius.** Converted here, once, for display. */
  temperature: number;
  /** **Celsius.** Open-Meteo's `apparent_temperature`. */
  apparentTemperature?: number;
  /** WMO code — read through `conditionFromCode`, never switched on directly. */
  weatherCode: number;
  /** Open-Meteo's `is_day`, as a boolean: `Boolean(current.is_day)`. */
  isDay: boolean;
  temperatureUnit: TemperatureUnit;
  /** **Celsius.** Today's daily max and min. */
  high?: number;
  low?: number;
  /** ISO timestamp of the reading, rendered as a local time. */
  observedAt?: string;
  /**
   * The row under the readout — wind, humidity, pressure, whatever the persona
   * leads with. A node rather than a data shape, because the four dashboards
   * disagree about what belongs there and a union of all four would be a prop
   * list no one could read.
   */
  secondary?: ReactNode;
}

/**
 * The current-conditions readout every dashboard opens with.
 *
 * The gradient is a picture of the sky, so it does not follow the colour
 * scheme — `skyGradient` picks it from the condition and the daylight flag, and
 * every pair it can return is dark enough to carry white text. That is why the
 * foreground here is a literal white rather than a palette token: the surface
 * underneath is the same in light and dark mode, so a scheme-aware text colour
 * would be unreadable in one of them.
 *
 * Laid out to hold at 360px. The temperature uses the `readout` variant, whose
 * `clamp()` shrinks it with the viewport, and the secondary row wraps rather
 * than scrolls — a horizontally scrolling figure is a figure nobody reads.
 */
export function HeroConditions({
  locationName,
  temperature,
  apparentTemperature,
  weatherCode,
  isDay,
  temperatureUnit,
  high,
  low,
  observedAt,
  secondary,
}: HeroConditionsProps) {
  const condition = conditionFromCode(weatherCode);

  const feelsLike =
    apparentTemperature !== undefined && Number.isFinite(apparentTemperature)
      ? formatTemperature(apparentTemperature, temperatureUnit, {
          showScale: false,
        })
      : null;

  const range =
    high !== undefined && low !== undefined
      ? `H ${formatTemperature(high, temperatureUnit, { showScale: false })}  ·  L ${formatTemperature(low, temperatureUnit, { showScale: false })}`
      : null;

  const observed =
    observedAt && !Number.isNaN(Date.parse(observedAt))
      ? new Date(observedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 4,
        p: { xs: 2.5, sm: 3.5 },
        color: "#FFFFFF",
        background: skyGradient(weatherCode, isDay),
        // The gradients are two-stop and can band on a wide, shallow box. A
        // faint radial highlight breaks the banding up and doubles as the
        // light source the 160deg ramp implies.
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(120% 80% at 78% 0%, rgba(255,255,255,0.16), rgba(255,255,255,0) 60%)",
        },
      }}
    >
      <Stack spacing={2} sx={{ position: "relative", zIndex: 1 }}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ alignItems: "center", minWidth: 0 }}
        >
          <PlaceOutlinedIcon aria-hidden sx={{ fontSize: 18, opacity: 0.85 }} />
          <Typography
            variant="subtitle2"
            component="p"
            sx={{
              // One line, ellipsised: a long reverse-geocoded name would
              // otherwise push the readout off the fold on a phone.
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: 0.92,
            }}
          >
            {locationName}
          </Typography>
        </Stack>

        <Box>
          <Typography variant="readout" component="p">
            {formatTemperature(temperature, temperatureUnit, {
              showScale: false,
            })}
            <Box
              component="span"
              // The scale letter, set small and lifted — it is a unit, not part
              // of the figure, and at full size it competes with the digits.
              sx={{
                fontSize: "0.32em",
                fontWeight: 600,
                verticalAlign: "super",
                ml: 0.5,
                opacity: 0.85,
              }}
            >
              {temperatureUnit === "f" ? "F" : "C"}
            </Box>
          </Typography>

          <Typography variant="h5" component="p" sx={{ mt: 1 }}>
            {condition.label}
          </Typography>

          <Stack
            direction="row"
            spacing={1.5}
            sx={{ mt: 0.5, flexWrap: "wrap", opacity: 0.88 }}
          >
            {feelsLike && (
              <Typography variant="body2">Feels like {feelsLike}</Typography>
            )}
            {range && <Typography variant="body2">{range}</Typography>}
            {observed && (
              <Typography variant="body2">Updated {observed}</Typography>
            )}
          </Stack>
        </Box>

        {secondary && (
          <Stack
            direction="row"
            sx={{
              flexWrap: "wrap",
              gap: 2,
              pt: 2,
              borderTop: "1px solid rgba(255, 255, 255, 0.22)",
            }}
          >
            {secondary}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
