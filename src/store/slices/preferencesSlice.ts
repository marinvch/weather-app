import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AppPreferences {
  theme: "light" | "dark" | "system";
  refreshInterval: number; // in minutes
  cacheExpiry: number; // in minutes
  autoLocation: boolean;
  showDetailed: boolean;
  compactView: boolean;
  showCharts: boolean;
  alertSensitivity: "low" | "medium" | "high";
  favoriteLocations: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>;
}

const initialState: AppPreferences = {
  theme: "system",
  refreshInterval: 15,
  cacheExpiry: 60,
  autoLocation: true,
  showDetailed: true,
  compactView: false,
  showCharts: true,
  alertSensitivity: "medium",
  favoriteLocations: [],
};

export const preferencesSlice = createSlice({
  name: "preferences",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<"light" | "dark" | "system">) => {
      state.theme = action.payload;
    },

    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload;
    },

    setCacheExpiry: (state, action: PayloadAction<number>) => {
      state.cacheExpiry = action.payload;
    },

    setAutoLocation: (state, action: PayloadAction<boolean>) => {
      state.autoLocation = action.payload;
    },

    setShowDetailed: (state, action: PayloadAction<boolean>) => {
      state.showDetailed = action.payload;
    },

    setCompactView: (state, action: PayloadAction<boolean>) => {
      state.compactView = action.payload;
    },

    setShowCharts: (state, action: PayloadAction<boolean>) => {
      state.showCharts = action.payload;
    },

    setAlertSensitivity: (
      state,
      action: PayloadAction<"low" | "medium" | "high">
    ) => {
      state.alertSensitivity = action.payload;
    },

    addFavoriteLocation: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        latitude: number;
        longitude: number;
      }>
    ) => {
      const exists = state.favoriteLocations.some(
        (loc) => loc.id === action.payload.id
      );
      if (!exists) {
        state.favoriteLocations.push(action.payload);
      }
    },

    removeFavoriteLocation: (state, action: PayloadAction<string>) => {
      state.favoriteLocations = state.favoriteLocations.filter(
        (loc) => loc.id !== action.payload
      );
    },

    updateFavoriteLocation: (
      state,
      action: PayloadAction<{
        id: string;
        updates: Partial<{
          name: string;
          latitude: number;
          longitude: number;
        }>;
      }>
    ) => {
      const index = state.favoriteLocations.findIndex(
        (loc) => loc.id === action.payload.id
      );
      if (index >= 0) {
        state.favoriteLocations[index] = {
          ...state.favoriteLocations[index],
          ...action.payload.updates,
        };
      }
    },

    updatePreferences: (
      state,
      action: PayloadAction<Partial<AppPreferences>>
    ) => {
      return { ...state, ...action.payload };
    },
  },
});

export const {
  setTheme,
  setRefreshInterval,
  setCacheExpiry,
  setAutoLocation,
  setShowDetailed,
  setCompactView,
  setShowCharts,
  setAlertSensitivity,
  addFavoriteLocation,
  removeFavoriteLocation,
  updateFavoriteLocation,
  updatePreferences,
} = preferencesSlice.actions;

export default preferencesSlice.reducer;
