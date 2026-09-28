import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditIcon from "@mui/icons-material/Edit";
import PlaceIcon from "@mui/icons-material/Place";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addFavoriteLocation,
  removeFavoriteLocation,
  updateFavoriteLocation,
  type FavoriteLocation,
} from "@/store/slices/preferencesSlice";
import { coordinatesKey, formatCoordinates } from "@/shared/lib/geo";
import type { Coordinates } from "@/shared/types/weather";

interface FavoriteLocationsProps {
  /** The location currently on screen — what "save this place" saves. */
  coordinates: Coordinates;
  locationName: string;
  onSelect: (favorite: FavoriteLocation) => void;
  /** Renders a labelled full-width button instead of a bare icon, for the
   * small-screen drawer where an unlabelled star has no context. */
  showLabel?: boolean;
}

/**
 * Saved places: save the current one, switch to one, rename one, remove one.
 *
 * The id is `coordinatesKey(coordinates)` — rounded to WGS 84 display
 * precision — so the same point cannot end up saved twice under two names, and
 * GPS jitter does not make "here" look like somewhere new. That is also what
 * lets the star show filled when the current location is already saved.
 */
export function FavoriteLocations({
  coordinates,
  locationName,
  onSelect,
  showLabel = false,
}: FavoriteLocationsProps) {
  const dispatch = useAppDispatch();
  const favorites = useAppSelector(
    (state) => state.preferences.favoriteLocations,
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [renaming, setRenaming] = useState<FavoriteLocation | null>(null);
  const [draftName, setDraftName] = useState("");

  const currentId = coordinatesKey(coordinates);
  const isSaved = favorites.some((favorite) => favorite.id === currentId);

  const close = () => setAnchorEl(null);

  const saveCurrent = () => {
    dispatch(
      addFavoriteLocation({
        id: currentId,
        name: locationName || formatCoordinates(coordinates),
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }),
    );
    close();
  };

  const startRename = (favorite: FavoriteLocation) => {
    setRenaming(favorite);
    setDraftName(favorite.name);
    close();
  };

  const commitRename = () => {
    if (!renaming) return;
    const name = draftName.trim();
    if (name) {
      dispatch(updateFavoriteLocation({ id: renaming.id, updates: { name } }));
    }
    setRenaming(null);
  };

  const label = `Saved places (${favorites.length})`;

  return (
    <>
      {showLabel ? (
        <Button
          fullWidth
          variant="outlined"
          size="small"
          startIcon={isSaved ? <StarIcon /> : <StarBorderIcon />}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{ justifyContent: "flex-start" }}
        >
          {label}
        </Button>
      ) : (
        <Tooltip title={label}>
          <IconButton
            size="small"
            aria-label={label}
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            {isSaved ? (
              <StarIcon fontSize="small" sx={{ color: "secondary.main" }} />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        slotProps={{ paper: { sx: { minWidth: 280, maxWidth: 360 } } }}
      >
        <MenuItem onClick={saveCurrent} disabled={isSaved}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            {isSaved ? (
              <StarIcon fontSize="small" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={isSaved ? "Already saved" : "Save this place"}
            secondary={locationName || formatCoordinates(coordinates)}
            slotProps={{ secondary: { noWrap: true } }}
          />
        </MenuItem>

        <Divider />

        {favorites.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", px: 2, py: 1.5 }}
          >
            No saved places yet.
          </Typography>
        ) : (
          favorites.map((favorite) => (
            <MenuItem
              key={favorite.id}
              selected={favorite.id === currentId}
              onClick={() => {
                onSelect(favorite);
                close();
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PlaceIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={favorite.name}
                secondary={formatCoordinates({
                  latitude: favorite.latitude,
                  longitude: favorite.longitude,
                })}
                slotProps={{ primary: { noWrap: true } }}
              />
              <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
                <IconButton
                  size="small"
                  aria-label={`Rename ${favorite.name}`}
                  onClick={(event) => {
                    // Without this the MenuItem's own onClick also fires and
                    // switches to the place you were trying to rename.
                    event.stopPropagation();
                    startRename(favorite);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Remove ${favorite.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    dispatch(removeFavoriteLocation(favorite.id));
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
            </MenuItem>
          ))
        )}
      </Menu>

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Rename saved place</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitRename();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>Cancel</Button>
          <Button onClick={commitRename} disabled={draftName.trim() === ""}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
