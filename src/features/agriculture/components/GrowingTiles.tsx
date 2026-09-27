import Box from "@mui/material/Box";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import GrassIcon from "@mui/icons-material/Grass";
import OpacityIcon from "@mui/icons-material/Opacity";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import WaterIcon from "@mui/icons-material/Water";
import WbSunnyIcon from "@mui/icons-material/WbSunny";
import { MetricTile } from "@/shared/ui/MetricTile";
import { formatPrecip, formatTemperature, type UnitSet } from "@/shared/lib/units";
import type { AgriculturalResponse } from "@/shared/types/weather";
import {
  frostRisk,
  growingConditions,
  tileSeverity,
  soilMoistureCondition,
  soilMoisturePercent,
} from "@/features/agriculture/lib/conditions";
import type { GddAccumulation } from "@/features/agriculture/lib/gdd";

export interface GrowingTilesProps {
  current: AgriculturalResponse["current"];
  /** Reference evapotranspiration today, mm. */
  et0Mm: number | undefined;
  gdd: GddAccumulation;
  unitSet: UnitSet;
}

/**
 * The growing readout.
 *
 * ⚠️ `soil_moisture_0_1cm` arrives as **m³/m³**, a 0–1 fraction, and every
 * threshold in `soilMoistureCondition` and `growingConditions` is a percentage.
 * The conversion happens once here, before anything compares it. Skipped, every
 * reading on Earth scores "Very dry — immediate irrigation needed", because
 * volumetric water content never reaches 10 on that scale.
 */
export function GrowingTiles({
  current,
  et0Mm,
  gdd,
  unitSet,
}: GrowingTilesProps) {
  const soilMoisture = Number.isFinite(current.soil_moisture_0_1cm)
    ? soilMoisturePercent(current.soil_moisture_0_1cm)
    : null;
  const soil = soilMoisture == null ? null : soilMoistureCondition(soilMoisture);
  const frost = frostRisk(current.temperature_2m);
  const growing =
    soilMoisture == null
      ? null
      : growingConditions(
          current.temperature_2m,
          current.relative_humidity_2m,
          soilMoisture,
        );

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
        label="Soil moisture"
        value={soilMoisture == null ? "—" : soilMoisture.toFixed(1)}
        unit="%"
        icon={<OpacityIcon />}
        severity={tileSeverity(soil?.severity)}
        hint={soil ? `${soil.text} — ${soil.advice}` : "Not reported for this point"}
      />

      <MetricTile
        label="Soil temperature"
        value={formatTemperature(current.soil_temperature_0cm, unitSet.temperature, {
          showScale: false,
        })}
        unit={degreeSymbol}
        icon={<ThermostatIcon />}
        hint="At the surface"
      />

      <MetricTile
        label="Frost risk"
        value={frost.text}
        icon={<AcUnitIcon />}
        severity={tileSeverity(frost.severity)}
        hint={frost.advice}
      />

      <MetricTile
        label="Growing conditions"
        value={growing?.condition ?? "—"}
        icon={<GrassIcon />}
        severity={tileSeverity(growing?.severity)}
        hint="Temperature, humidity and soil moisture together"
      />

      <MetricTile
        label="Degree-days"
        value={gdd.days.length > 0 ? gdd.total.toFixed(0) : "—"}
        unit="GDD"
        icon={<WbSunnyIcon />}
        hint={
          gdd.days.length > 0
            ? `Base ${gdd.base}°C over ${gdd.days.length} days`
            : "No daily temperatures"
        }
      />

      <MetricTile
        label="Evapotranspiration"
        value={
          typeof et0Mm === "number"
            ? formatPrecip(et0Mm, unitSet.precipitation)
            : "—"
        }
        icon={<WaterIcon />}
        hint="Reference ET₀ today — what the crop will lose"
      />
    </Box>
  );
}
