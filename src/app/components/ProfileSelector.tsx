import FormControl from "@mui/material/FormControl";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import PeopleIcon from "@mui/icons-material/People";
import SailingIcon from "@mui/icons-material/Sailing";
import TerrainIcon from "@mui/icons-material/Terrain";
import GrassIcon from "@mui/icons-material/Grass";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setProfile } from "@/store/slices/userProfileSlice";
import type { UserProfile } from "@/shared/types/weather";

/**
 * The four personas, in one place.
 *
 * This is the closest thing the app has to a profile registry. A fifth persona
 * still means editing the UserProfile union, the switch in App.tsx and this
 * map — the compiler catches the first two but not this one.
 */
const PROFILES: Record<
  UserProfile,
  { label: string; description: string; icon: React.ReactNode }
> = {
  general: {
    label: "General",
    description: "What to wear today",
    icon: <PeopleIcon fontSize="small" />,
  },
  marine: {
    label: "Marine & fishing",
    description: "Sea state, waves, whether to go out",
    icon: <SailingIcon fontSize="small" />,
  },
  mountain: {
    label: "Mountaineering",
    description: "Ascent prep, avalanche, altitude wind",
    icon: <TerrainIcon fontSize="small" />,
  },
  agriculture: {
    label: "Growing",
    description: "Soil, frost, irrigation",
    icon: <GrassIcon fontSize="small" />,
  },
};

export function ProfileSelector() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.userProfile.profile);

  const handleChange = (event: SelectChangeEvent) => {
    dispatch(setProfile(event.target.value as UserProfile));
  };

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <Select
        value={profile}
        onChange={handleChange}
        inputProps={{ "aria-label": "Weather profile" }}
        renderValue={(value) => PROFILES[value as UserProfile].label}
      >
        {(Object.keys(PROFILES) as UserProfile[]).map((key) => (
          <MenuItem key={key} value={key}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              {PROFILES[key].icon}
            </ListItemIcon>
            <ListItemText
              primary={PROFILES[key].label}
              secondary={PROFILES[key].description}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
