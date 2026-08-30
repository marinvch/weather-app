import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { normalizeCoordinates } from '@/shared/lib/geo';
import type {
  Coordinates,
  UserProfile,
  UserPreferences,
} from '@/shared/types/weather';

const initialState: UserPreferences = {
  profile: "general",
  units: "metric",
  language: "en",
  timezone: "auto",
  location: null,
  locationName: "",
};

export const userProfileSlice = createSlice({
  name: "userProfile",
  initialState,
  reducers: {
    setProfile: (state, action: PayloadAction<UserProfile>) => {
      state.profile = action.payload;
    },
    setUnits: (state, action: PayloadAction<"metric" | "imperial">) => {
      state.units = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    setTimezone: (state, action: PayloadAction<string>) => {
      state.timezone = action.payload;
    },
    /**
     * The store holds WGS 84 decimal degrees and nothing else — see
     * `@/shared/lib/geo`. Normalizing here means every reader downstream (three
     * Open-Meteo hosts, Nominatim, Leaflet) gets a point already in range,
     * rather than each of them having to defend against the antimeridian.
     */
    setLocation: (state, action: PayloadAction<Coordinates | null>) => {
      state.location = action.payload
        ? normalizeCoordinates(action.payload)
        : null;
    },
    setLocationName: (state, action: PayloadAction<string>) => {
      state.locationName = action.payload;
    },
    updatePreferences: (
      state,
      action: PayloadAction<Partial<UserPreferences>>
    ) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setProfile,
  setUnits,
  setLanguage,
  setTimezone,
  setLocation,
  setLocationName,
  updatePreferences,
} = userProfileSlice.actions;

export default userProfileSlice.reducer;
