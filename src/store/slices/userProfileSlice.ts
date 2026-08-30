import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { UserProfile, UserPreferences } from "../../types/weather";

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
    setLocation: (
      state,
      action: PayloadAction<{ latitude: number; longitude: number } | null>
    ) => {
      state.location = action.payload;
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
