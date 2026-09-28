import Box from "@mui/material/Box";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import LandscapeIcon from "@mui/icons-material/Landscape";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { MetricTile } from "@/shared/ui/MetricTile";
import { formatTemperature, type UnitSet } from "@/shared/lib/units";
import {
  exposureFromWindChill,
  tileSeverity,
  visibilityCondition,
  windChill,
  windChillApplies,
  type FreezingLevelReading,
  type SnowDepthReading,
} from "@/features/mountain/lib/conditions";

export interface AltitudeTilesProps {
  /** Metres above sea level, from the model's terrain. Absent for some points. */
  elevationMetres: number | undefined;
  temperatureC: number;
  windKmh: number;
  weatherCode: number;
  freezing: FreezingLevelReading | null;
  snow: SnowDepthReading | null;
  unitSet: UnitSet;
}

/**
 * The altitude readout — elevation first, because altitude is the whole reason
 * this persona exists.
 *
 * Wind chill is shown as its own tile rather than only as a "feels like",
 * because it is a different number with a different meaning: the temperature
 * says what to wear and the chill says how long exposed skin lasts. Outside
 * the formula's domain the tile says so instead of repeating the air
 * temperature, which would read as a wind chill that happens to match.
 */
export function AltitudeTiles({
  elevationMetres,
  temperatureC,
  windKmh,
  weatherCode,
  freezing,
  snow,
  unitSet,
}: AltitudeTilesProps) {
  const chill = windChill(temperatureC, windKmh);
  const chillApplies = windChillApplies(temperatureC, windKmh);
  const exposure = exposureFromWindChill(chill);
  const visibility = visibilityCondition(weatherCode);
  const degreeSymbol = unitSet.temperature === "f" ? "°F" : "°C";

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
      }}
    >
      <MetricTile
        label="Elevation"
        value={elevationMetres != null ? Math.round(elevationMetres) : "—"}
        unit="m"
        icon={<LandscapeIcon />}
        hint={
          elevationMetres != null
            ? "Model terrain height, above sea level"
            : "Not reported for this point"
        }
      />

      <MetricTile
        label="Temperature"
        value={formatTemperature(temperatureC, unitSet.temperature, {
          showScale: false,
        })}
        unit={degreeSymbol}
        icon={<ThermostatIcon />}
        hint={
          chillApplies
            ? `Feels like ${formatTemperature(chill, unitSet.temperature)} in the wind`
            : "No wind chill at this temperature"
        }
      />

      <MetricTile
        label="Wind chill"
        value={
          chillApplies
            ? formatTemperature(chill, unitSet.temperature, { showScale: false })
            : "—"
        }
        unit={degreeSymbol}
        icon={<AcUnitIcon />}
        severity={chillApplies ? tileSeverity(exposure.severity) : 0}
        hint={
          chillApplies
            ? exposure.text
            : "Only defined below 10°C and above 4.8 km/h"
        }
      />

      <MetricTile
        label="Freezing level"
        value={freezing != null ? Math.round(freezing.heightMetres) : "—"}
        unit="m"
        icon={<AcUnitIcon />}
        severity={tileSeverity(freezing?.severity)}
        hint={freezing?.text ?? "Not reported for this point"}
      />

      <MetricTile
        label="Snow depth"
        value={snow != null ? Math.round(snow.centimetres) : "—"}
        unit="cm"
        icon={<AcUnitIcon />}
        severity={tileSeverity(snow?.severity)}
        hint={snow?.text ?? "Not reported for this point"}
      />

      <MetricTile
        label="Visibility"
        value={visibility.text}
        icon={<VisibilityIcon />}
        severity={tileSeverity(visibility.severity)}
        hint={visibility.cause}
      />
    </Box>
  );
}
