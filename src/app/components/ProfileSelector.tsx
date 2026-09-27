import FormControl from "@mui/material/FormControl";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setProfile } from "@/store/slices/userProfileSlice";
import { PROFILES, PROFILE_IDS } from "@/app/profiles";
import type { UserProfile } from "@/shared/types/weather";

/**
 * Switches the lens. Labels, descriptions and icons all come from the profile
 * registry — this component holds no list of its own, which is what stopped a
 * fifth persona meaning three edits.
 */
export function ProfileSelector({ fullWidth = false }: { fullWidth?: boolean }) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.userProfile.profile);

  const handleChange = (event: SelectChangeEvent) => {
    dispatch(setProfile(event.target.value as UserProfile));
  };

  return (
    <FormControl
      size="small"
      fullWidth={fullWidth}
      sx={{ minWidth: fullWidth ? undefined : 180 }}
    >
      <Select
        value={profile}
        onChange={handleChange}
        inputProps={{ "aria-label": "Weather profile" }}
        renderValue={(value) => PROFILES[value as UserProfile].label}
      >
        {PROFILE_IDS.map((id) => (
          <MenuItem key={id} value={id}>
            <ListItemIcon sx={{ minWidth: 36 }}>{PROFILES[id].icon}</ListItemIcon>
            <ListItemText
              primary={PROFILES[id].label}
              secondary={PROFILES[id].description}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
