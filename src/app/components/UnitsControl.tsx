import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setUnits } from "@/store/slices/userProfileSlice";
import type { UnitSystem } from "@/shared/lib/units";

/**
 * Metric or imperial — a *display* preference and nothing more.
 *
 * Every reading in the store stays metric and every threshold in a feature's
 * `advice.ts` is compared against the metric value, so switching this changes
 * what is written on the screen and never what the app concludes. See
 * `@/shared/lib/units`.
 */
export function UnitsControl({ fullWidth = false }: { fullWidth?: boolean }) {
  const dispatch = useAppDispatch();
  const units = useAppSelector((state) => state.userProfile.units);

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={units}
      fullWidth={fullWidth}
      aria-label="Units"
      onChange={(_event, next: UnitSystem | null) => {
        if (next) dispatch(setUnits(next));
      }}
    >
      <Tooltip title="Metric — °C, km/h, mm">
        <ToggleButton value="metric" aria-label="Metric units">
          °C
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Imperial — °F, mph, in">
        <ToggleButton value="imperial" aria-label="Imperial units">
          °F
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
}
