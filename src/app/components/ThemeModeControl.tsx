import { useEffect } from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import { useColorScheme } from "@mui/material/styles";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setTheme } from "@/store/slices/preferencesSlice";
import type { AppPreferences } from "@/store/slices/preferencesSlice";

type ThemeMode = AppPreferences["theme"];

const MODES: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> =
  [
    { value: "light", label: "Light", icon: <LightModeIcon fontSize="small" /> },
    {
      value: "system",
      label: "Match system",
      icon: <SettingsBrightnessIcon fontSize="small" />,
    },
    { value: "dark", label: "Dark", icon: <DarkModeIcon fontSize="small" /> },
  ];

/**
 * Keeps MUI's colour scheme following Redux. **Redux → MUI, one direction, and
 * deliberately not the other.**
 *
 * Both sides hold a mode and both can persist it, so a two-way sync is a loop:
 * MUI's `setMode` writes its own localStorage key and re-renders, a listener
 * would dispatch back into Redux, the selector fires and calls `setMode` again.
 * Redux is the owner because `preferences.theme` is the value the user set, it
 * is what `@/store/persistence` writes, and it is the one MUI cannot know about.
 * MUI's `mui-mode` key is a cache we overwrite on mount, not a source of truth.
 *
 * That write is still load-bearing: the inline anti-flash script in
 * `index.html` reads `mui-mode` before React boots, so pushing Redux into
 * `setMode` is what keeps the pre-paint scheme correct on the next load. Remove
 * this component and the app boots in the wrong scheme for a frame, then jumps.
 *
 * Renders nothing, and must stay mounted for the whole session — mount it in
 * the shell, not inside the control, which can be inside a closed drawer.
 */
export function ThemeModeSync() {
  const preferred = useAppSelector((state) => state.preferences.theme);
  const { mode, setMode } = useColorScheme();

  useEffect(() => {
    // Compare before setting. `mode` is undefined until MUI has mounted, so the
    // first pass always writes; after that this is a no-op, which keeps the
    // effect safe even if `setMode` is not referentially stable.
    if (mode !== preferred) setMode(preferred);
  }, [preferred, mode, setMode]);

  return null;
}

/**
 * Light / system / dark. Dispatches to Redux only; `ThemeModeSync` is what
 * turns that into an actual colour scheme change.
 */
export function ThemeModeControl({ fullWidth = false }: { fullWidth?: boolean }) {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((state) => state.preferences.theme);

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      fullWidth={fullWidth}
      aria-label="Theme"
      onChange={(_event, next: ThemeMode | null) => {
        // null means the active button was clicked again. An exclusive group
        // has no meaningful "none", so ignore it rather than clearing.
        if (next) dispatch(setTheme(next));
      }}
    >
      {MODES.map(({ value, label, icon }) => (
        <Tooltip key={value} title={label}>
          <ToggleButton value={value} aria-label={label}>
            {icon}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
