import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * One saved place. `id` is `coordinatesKey(...)`, so the same point cannot be
 * saved twice under two names.
 */
export interface FavoriteLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface AppPreferences {
  theme: "light" | "dark" | "system";
  refreshInterval: number; // in minutes
  cacheExpiry: number; // in minutes
  autoLocation: boolean;
  showDetailed: boolean;
  compactView: boolean;
  showCharts: boolean;
  alertSensitivity: "low" | "medium" | "high";
  favoriteLocations: FavoriteLocation[];
}

/**
 * Exported so the persistence layer can fall back to it field by field when a
 * stored value fails validation.
 */
export const initialPreferencesState: AppPreferences = {
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
  initialState: initialPreferencesState,
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

    addFavoriteLocation: (state, action: PayloadAction<FavoriteLocation>) => {
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
        updates: Partial<Omit<FavoriteLocation, "id">>;
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
