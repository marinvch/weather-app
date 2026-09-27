import { useEffect, useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { normalizeCoordinates } from "@/shared/lib/geo";
import { describeQueryError } from "@/shared/lib/queryError";
import type { GeocodingResult } from "@/shared/types/weather";
import { useSearchPlacesQuery } from "@/features/location/api/geocodingApi";
import {
  formatPlaceName,
  placeKey,
  placeSecondaryText,
} from "@/features/location/lib/places";

export interface LocationSearchProps {
  /**
   * The chosen place. `name` is a readable composite ("Burgas, Bulgaria") for
   * display only; the coordinate is the location. They travel together and are
   * never the same field.
   */
  onSelect: (place: {
    latitude: number;
    longitude: number;
    name: string;
  }) => void;
  fullWidth?: boolean;
}

/**
 * Below this, a search is not a search. Two characters is roughly where
 * Open-Meteo stops returning "every place on Earth beginning with B", and one
 * character is a request whose result nobody can use.
 */
const MIN_QUERY_LENGTH = 2;

/**
 * Long enough that typing "Burgas" is one request rather than six, short enough
 * that the list feels live. Open-Meteo does not rate-limit this endpoint
 * aggressively, but a request per keystroke is still six times the work for a
 * result only the last one is used.
 */
const DEBOUNCE_MS = 300;

/**
 * Search for a place by name.
 *
 * The app previously had exactly one way to change location — the browser's
 * geolocation button — so a person could look at the weather where they stood
 * and nowhere else. This is the other way.
 *
 * `freeSolo`, because the typed text has to survive a request that returns
 * nothing: a strict `Autocomplete` clears the input when no option matches,
 * which deletes what someone just typed the moment their spelling is a little
 * off.
 */
export function LocationSearch({ onSelect, fullWidth }: LocationSearchProps) {
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");

  // Debounce: `input` follows the keyboard, `term` follows the network. The
  // cleanup cancels the pending timer on every keystroke, so only a pause
  // longer than DEBOUNCE_MS ever reaches the query.
  useEffect(() => {
    const trimmed = input.trim();
    const timer = setTimeout(() => setTerm(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const skip = term.length < MIN_QUERY_LENGTH;
  const { data, isFetching, error } = useSearchPlacesQuery(term, { skip });

  const options = useMemo(() => data ?? [], [data]);

  // The three states the dropdown has to distinguish, in priority order. A
  // single "no options" string for all three is what makes a search box feel
  // broken: "keep typing", "still looking" and "there is no such place" are
  // different answers.
  const noOptionsText = skip
    ? `Type at least ${MIN_QUERY_LENGTH} characters`
    : error
      ? describeQueryError(error)
      : isFetching
        ? "Searching…"
        : `No place matches “${term}”`;

  return (
    <Autocomplete<GeocodingResult, false, false, true>
      freeSolo
      fullWidth={fullWidth}
      sx={{ minWidth: fullWidth ? undefined : 260 }}
      options={options}
      // The server already filtered. Without this, MUI filters the ten results
      // again against the raw input and hides every hit whose display name is
      // spelled differently from what was typed — which is most of them.
      filterOptions={(option) => option}
      inputValue={input}
      onInputChange={(_event, value) => setInput(value)}
      // Nothing is "selected" after a pick: the parent owns the location, and
      // leaving a stale name in the box implies this component is the source of
      // truth for where you are, which it is not.
      value={null}
      loading={isFetching && !skip}
      noOptionsText={noOptionsText}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : formatPlaceName(option)
      }
      isOptionEqualToValue={(option, value) =>
        // `freeSolo` widens `value` to include the raw typed string, which is
        // never equal to an option — a string has no coordinate to compare.
        typeof value !== "string" && placeKey(option) === placeKey(value)
      }
      onChange={(_event, value) => {
        // `freeSolo` means `value` can be the raw string when someone presses
        // Enter without picking a row. Nothing here geocodes a bare name, so
        // that case is ignored rather than guessed at.
        if (!value || typeof value === "string") return;

        // The result arrives from outside the app, so it normalizes here — at
        // the boundary that admits it — and nowhere else afterwards.
        const { latitude, longitude } = normalizeCoordinates(value);
        onSelect({ latitude, longitude, name: formatPlaceName(value) });
        setInput("");
      }}
      renderOption={(props, option) => {
        // MUI puts the key on `props`, and React 19 still warns when a key is
        // spread rather than passed, so it comes off first and goes on
        // explicitly.
        const { key, ...liProps } = props;
        const secondary = placeSecondaryText(option);

        return (
          <Box component="li" key={key} {...liProps}>
            <Stack
              direction="row"
              spacing={1.25}
              sx={{ alignItems: "center", minWidth: 0, width: "100%" }}
            >
              <PlaceOutlinedIcon
                aria-hidden
                sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {option.name}
                </Typography>
                {/*
                  The disambiguator. Eleven places are called Springfield, and
                  without this line they are eleven identical rows.
                */}
                {secondary && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      color: "text.secondary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {secondary}
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label="Search for a place"
          placeholder="City, town or village"
          error={Boolean(error) && !skip}
          // The error goes in the helper text as well as the dropdown, because
          // the dropdown closes and the failure should not vanish with it.
          helperText={error && !skip ? describeQueryError(error) : undefined}
          // MUI v9 moved the render-input plumbing from `params.InputProps` to
          // `params.slotProps.input`. Spreading it back in is not optional:
          // it carries the `ref` and the `onMouseDown` the popup opens on, so
          // dropping it leaves a text box that never opens its own list.
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <>
                  {isFetching && !skip && (
                    <CircularProgress
                      size={16}
                      // Announced by the dropdown's own text; a second live
                      // region here would read the same thing twice.
                      aria-label="Searching for places"
                    />
                  )}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
