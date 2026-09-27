import Box from "@mui/material/Box";
import AirIcon from "@mui/icons-material/Air";
import NavigationIcon from "@mui/icons-material/Navigation";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import TimerIcon from "@mui/icons-material/Timer";
import WavesIcon from "@mui/icons-material/Waves";
import { MetricTile } from "@/shared/ui/MetricTile";
import {
  convertSpeed,
  degreesToCardinal,
  formatSpeed,
  formatTemperature,
  type UnitSet,
} from "@/shared/lib/units";
import type { CurrentWeather } from "@/shared/types/weather";
import type { MarineReadings } from "@/features/marine/lib/readings";
import {
  beaufortFromKmh,
  douglasFromWaveHeight,
  tileSeverity,
  waterTemperatureReading,
} from "@/features/marine/lib/seaState";

export interface SeaStateTilesProps {
  readings: MarineReadings;
  /** From the forecast host — the marine host reports no wind at all. */
  air: CurrentWeather | undefined;
  unitSet: UnitSet;
}

/** A metre reading, or an em dash. Never a stand-in zero on a null. */
function metres(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

/**
 * The sea-state readout.
 *
 * Wind is shown in **knots** whatever the unit preference, with m/s and the
 * preferred unit in the hint. Knots are not an imperial choice — a mariner
 * working in metric still wants knots — which is why `unitsFor` deliberately
 * cannot return them and this passes `"kn"` explicitly.
 */
export function SeaStateTiles({ readings: r, air, unitSet }: SeaStateTilesProps) {
  const sea = douglasFromWaveHeight(r.waveHeight);
  const wind = beaufortFromKmh(air?.wind_speed_10m ?? null);
  const water = waterTemperatureReading(r.seaSurfaceTemperature);
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
        label="Significant wave"
        value={metres(r.waveHeight)}
        unit="m"
        icon={<WavesIcon />}
        severity={tileSeverity(sea?.risk)}
        hint={sea ? `Douglas ${sea.degree} · ${sea.label}` : "No reading"}
      />

      <MetricTile
        label="Wind"
        value={air ? convertSpeed(air.wind_speed_10m, "kn").toFixed(0) : "—"}
        unit="kn"
        icon={<AirIcon />}
        severity={tileSeverity(wind?.risk)}
        hint={
          air
            ? `${formatSpeed(air.wind_speed_10m, "ms")} · ${formatSpeed(air.wind_speed_10m, unitSet.speed)} · from ${degreesToCardinal(air.wind_direction_10m)}`
            : "Not reported"
        }
      />

      <MetricTile
        label="Beaufort force"
        value={wind ? wind.force : "—"}
        icon={<AirIcon />}
        severity={tileSeverity(wind?.risk)}
        hint={wind ? wind.label : "No wind reading"}
      />

      <MetricTile
        label="Swell"
        value={metres(r.swellHeight)}
        unit="m"
        icon={<NavigationIcon />}
        hint={
          r.swellDirection != null
            ? `From the ${degreesToCardinal(r.swellDirection)} · ${Math.round(r.swellDirection)}°`
            : "Direction not reported"
        }
      />

      <MetricTile
        label="Wind wave"
        value={metres(r.windWaveHeight)}
        unit="m"
        icon={<WavesIcon />}
        hint={
          r.windWaveDirection != null
            ? `From the ${degreesToCardinal(r.windWaveDirection)} · locally generated`
            : "Locally generated"
        }
      />

      <MetricTile
        label="Dominant swell bearing"
        value={r.swellDirection != null ? degreesToCardinal(r.swellDirection) : "—"}
        icon={<NavigationIcon />}
        hint={
          r.swellPeriod != null
            ? `Period ${r.swellPeriod.toFixed(1)} s`
            : "Period not reported"
        }
      />

      <MetricTile
        label="Wave period"
        value={r.wavePeriod != null ? r.wavePeriod.toFixed(1) : "—"}
        unit="s"
        icon={<TimerIcon />}
        hint="Between crests — longer is a gentler ride"
      />

      <MetricTile
        label="Sea surface"
        value={
          r.seaSurfaceTemperature != null
            ? formatTemperature(r.seaSurfaceTemperature, unitSet.temperature, {
                showScale: false,
              })
            : "—"
        }
        unit={degreeSymbol}
        icon={<ThermostatIcon />}
        severity={tileSeverity(water?.risk)}
        hint={water ? water.text : "Not reported"}
      />

      <MetricTile
        label="Surface current"
        value={
          r.currentVelocity != null
            ? convertSpeed(r.currentVelocity, "kn").toFixed(1)
            : "—"
        }
        unit="kn"
        icon={<NavigationIcon />}
        hint={
          r.currentDirection != null
            ? `Setting ${degreesToCardinal(r.currentDirection)}`
            : "Set not reported"
        }
      />
    </Box>
  );
}
