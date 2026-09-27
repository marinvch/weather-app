import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import ShieldIcon from "@mui/icons-material/Shield";
import TuneIcon from "@mui/icons-material/Tune";

import { OfflineIndicator } from "@/features/pwa/components/OfflineIndicator";
import { ProfileSelector } from "@/app/components/ProfileSelector";
import { ThemeModeControl } from "@/app/components/ThemeModeControl";
import { UnitsControl } from "@/app/components/UnitsControl";
import { FavoriteLocations } from "@/app/components/FavoriteLocations";
import type { FavoriteLocation } from "@/store/slices/preferencesSlice";
import type { Coordinates } from "@/shared/types/weather";

interface HeaderControlsProps {
  coordinates: Coordinates;
  locationName: string;
  onSelectFavorite: (favorite: FavoriteLocation) => void;
  onRequestLocation: () => void;
  isLoadingLocation: boolean;
  /** Emergency numbers are only known once a place has been resolved. */
  emergencyAvailable: boolean;
  emergencyOpen: boolean;
  onToggleEmergency: () => void;
}

/**
 * Everything in the header that is not the title or the search box.
 *
 * Seven controls do not fit on a 360px screen, and letting a `flexWrap` toolbar
 * decide what happens produces three ragged rows of half-width buttons. Below
 * `md` they collapse into a settings drawer instead: the toolbar keeps only what
 * is glanceable (offline state) or urgent (locate me), and the rest lives one
 * tap away, full width, where the labels fit.
 *
 * The controls themselves are the same components in both layouts — only the
 * container changes — so there is no second copy to keep in step.
 */
export function HeaderControls({
  coordinates,
  locationName,
  onSelectFavorite,
  onRequestLocation,
  isLoadingLocation,
  emergencyAvailable,
  emergencyOpen,
  onToggleEmergency,
}: HeaderControlsProps) {
  const compact = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const favorites = (
    <FavoriteLocations
      coordinates={coordinates}
      locationName={locationName}
      onSelect={onSelectFavorite}
      showLabel={compact}
    />
  );

  const emergencyButton = emergencyAvailable ? (
    <Button
      fullWidth={compact}
      variant={emergencyOpen ? "contained" : "outlined"}
      color="error"
      size="small"
      startIcon={<ShieldIcon />}
      onClick={onToggleEmergency}
      sx={compact ? { justifyContent: "flex-start" } : undefined}
    >
      Emergency
    </Button>
  ) : null;

  if (!compact) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <OfflineIndicator />
        <ProfileSelector />
        <UnitsControl />
        <ThemeModeControl />
        {favorites}

        <Button
          variant="outlined"
          size="small"
          onClick={onRequestLocation}
          disabled={isLoadingLocation}
          startIcon={
            isLoadingLocation ? <CircularProgress size={16} /> : <MyLocationIcon />
          }
        >
          {isLoadingLocation ? "Locating…" : "Use my location"}
        </Button>

        {emergencyButton}
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <OfflineIndicator />

      <Tooltip title="Use my location">
        {/* A span, because a disabled button fires no events and Tooltip needs
            one to know the pointer is over it. */}
        <span>
          <IconButton
            size="small"
            aria-label="Use my location"
            onClick={onRequestLocation}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <CircularProgress size={18} />
            ) : (
              <MyLocationIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Settings">
        <IconButton
          size="small"
          aria-label="Settings"
          onClick={() => setDrawerOpen(true)}
        >
          <TuneIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: "min(320px, 90vw)" } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="h6" component="h2">
              Settings
            </Typography>
            <IconButton
              size="small"
              aria-label="Close settings"
              onClick={() => setDrawerOpen(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Divider />

          <Box>
            <Typography variant="label" sx={{ color: "text.secondary" }}>
              Profile
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <ProfileSelector fullWidth />
            </Box>
          </Box>

          <Box>
            <Typography variant="label" sx={{ color: "text.secondary" }}>
              Units
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <UnitsControl fullWidth />
            </Box>
          </Box>

          <Box>
            <Typography variant="label" sx={{ color: "text.secondary" }}>
              Theme
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <ThemeModeControl fullWidth />
            </Box>
          </Box>

          <Divider />

          {favorites}
          {emergencyButton}
        </Stack>
      </Drawer>
    </Stack>
  );
}
