import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { WeatherAlert } from "../../types/weather";

interface AlertsState {
  alerts: WeatherAlert[];
  notifications: {
    enabled: boolean;
    sound: boolean;
    types: ("info" | "warning" | "danger")[];
  };
  history: WeatherAlert[];
}

const initialState: AlertsState = {
  alerts: [],
  notifications: {
    enabled: true,
    sound: false,
    types: ["warning", "danger"],
  },
  history: [],
};

export const alertsSlice = createSlice({
  name: "alerts",
  initialState,
  reducers: {
    addAlert: (state, action: PayloadAction<WeatherAlert>) => {
      // Check if alert already exists
      const existingIndex = state.alerts.findIndex(
        (alert) => alert.id === action.payload.id
      );
      if (existingIndex >= 0) {
        state.alerts[existingIndex] = action.payload;
      } else {
        state.alerts.push(action.payload);
      }

      // Add to history if it's not already there
      const historyExists = state.history.some(
        (alert) => alert.id === action.payload.id
      );
      if (!historyExists) {
        state.history.unshift(action.payload);
        // Keep only last 50 alerts in history
        if (state.history.length > 50) {
          state.history = state.history.slice(0, 50);
        }
      }
    },

    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(
        (alert) => alert.id !== action.payload
      );
    },

    clearAlerts: (state) => {
      state.alerts = [];
    },

    updateNotificationSettings: (
      state,
      action: PayloadAction<Partial<AlertsState["notifications"]>>
    ) => {
      state.notifications = { ...state.notifications, ...action.payload };
    },

    markAlertAsRead: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find((alert) => alert.id === action.payload);
      if (alert) {
        // Could add a 'read' property to the alert type if needed
      }
    },

    clearHistory: (state) => {
      state.history = [];
    },
  },
});

export const {
  addAlert,
  removeAlert,
  clearAlerts,
  updateNotificationSettings,
  markAlertAsRead,
  clearHistory,
} = alertsSlice.actions;

export default alertsSlice.reducer;
