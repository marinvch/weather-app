import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { WeatherAlert } from "@/shared/types/weather";

/**
 * Alerts — threshold breaches the user has opted into.
 *
 * An **Alert** is not a **Tip** and not a **Notification**: a Tip is advisory
 * text an Analysis produces and nothing persists, and a Notification is the PWA
 * delivery mechanism for an Alert. See `CONTEXT.md`.
 *
 * Read and dismissed state are kept as **id lists beside the alerts**, not as
 * fields on `WeatherAlert`. That shape is deliberate: `WeatherAlert` is a
 * `@/shared/types/weather` type shared with the derivation layer, which produces
 * alerts from a forecast and has no idea what has been read. Keeping the two
 * apart means re-deriving the same forecast cannot resurrect a dismissed alert
 * or silently mark a read one unread.
 */

interface AlertsState {
  alerts: WeatherAlert[];
  notifications: {
    enabled: boolean;
    sound: boolean;
    types: ("info" | "warning" | "danger")[];
  };
  history: WeatherAlert[];
  /** Ids the user has seen. Survives an alert being re-derived. */
  readIds: string[];
  /**
   * Ids the user has dismissed. `addAlert` refuses these, which is what makes
   * dismissal stick — without it, the next derivation from the same forecast
   * puts the alert straight back on screen and the dismiss button looks broken.
   */
  dismissedIds: string[];
}

/** Bounds on the two id lists, so a long session cannot grow them without end. */
const MAX_HISTORY = 50;
const MAX_TRACKED_IDS = 200;

/** Keeps the newest ids and drops the oldest. */
function capIds(ids: string[]): string[] {
  return ids.length > MAX_TRACKED_IDS ? ids.slice(-MAX_TRACKED_IDS) : ids;
}

const initialState: AlertsState = {
  alerts: [],
  notifications: {
    enabled: true,
    sound: false,
    types: ["warning", "danger"],
  },
  history: [],
  readIds: [],
  dismissedIds: [],
};

export const alertsSlice = createSlice({
  name: "alerts",
  initialState,
  reducers: {
    addAlert: (state, action: PayloadAction<WeatherAlert>) => {
      // A dismissed alert stays dismissed. The derivation is a pure function of
      // the forecast, so it re-emits the same alert on every refetch; without
      // this guard, dismissing anything is a button that does nothing for one
      // render and then undoes itself.
      if (state.dismissedIds.includes(action.payload.id)) return;

      const existingIndex = state.alerts.findIndex(
        (alert) => alert.id === action.payload.id,
      );
      if (existingIndex >= 0) {
        state.alerts[existingIndex] = action.payload;
      } else {
        state.alerts.push(action.payload);
      }

      const historyExists = state.history.some(
        (alert) => alert.id === action.payload.id,
      );
      if (!historyExists) {
        state.history.unshift(action.payload);
        if (state.history.length > MAX_HISTORY) {
          state.history = state.history.slice(0, MAX_HISTORY);
        }
      }
    },

    /**
     * Replace the active set in one action.
     *
     * The derivation produces a whole list from a forecast, so applying it one
     * `addAlert` at a time leaves any alert whose conditions have *passed*
     * sitting on screen forever. This is what a re-derive should dispatch.
     */
    setAlerts: (state, action: PayloadAction<WeatherAlert[]>) => {
      const incoming = action.payload.filter(
        (alert) => !state.dismissedIds.includes(alert.id),
      );

      state.alerts = incoming;

      for (const alert of incoming) {
        if (!state.history.some((entry) => entry.id === alert.id)) {
          state.history.unshift(alert);
        }
      }
      if (state.history.length > MAX_HISTORY) {
        state.history = state.history.slice(0, MAX_HISTORY);
      }
    },

    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(
        (alert) => alert.id !== action.payload,
      );
      if (!state.dismissedIds.includes(action.payload)) {
        state.dismissedIds = capIds([...state.dismissedIds, action.payload]);
      }
    },

    clearAlerts: (state) => {
      // Clearing is dismissing all of them, not forgetting they existed —
      // otherwise "clear" is a button whose effect lasts until the next
      // refetch.
      const ids = state.alerts.map((alert) => alert.id);
      state.dismissedIds = capIds([
        ...state.dismissedIds,
        ...ids.filter((id) => !state.dismissedIds.includes(id)),
      ]);
      state.alerts = [];
    },

    updateNotificationSettings: (
      state,
      action: PayloadAction<Partial<AlertsState["notifications"]>>,
    ) => {
      state.notifications = { ...state.notifications, ...action.payload };
    },

    /**
     * Mark one alert read.
     *
     * This used to find the alert and then do nothing — a literal empty `if`
     * body with a comment where the work belonged, so every alert stayed unread
     * for the life of the app. The id goes in `readIds`; `WeatherAlert` itself
     * is shared with the derivation layer and gains no field.
     */
    markAlertAsRead: (state, action: PayloadAction<string>) => {
      if (state.readIds.includes(action.payload)) return;
      state.readIds = capIds([...state.readIds, action.payload]);
    },

    markAllAlertsAsRead: (state) => {
      const unread = state.alerts
        .map((alert) => alert.id)
        .filter((id) => !state.readIds.includes(id));
      if (unread.length === 0) return;
      state.readIds = capIds([...state.readIds, ...unread]);
    },

    markAlertAsUnread: (state, action: PayloadAction<string>) => {
      state.readIds = state.readIds.filter((id) => id !== action.payload);
    },

    /** Undo every dismissal, so cleared alerts can come back on the next derive. */
    restoreDismissedAlerts: (state) => {
      state.dismissedIds = [];
    },

    clearHistory: (state) => {
      state.history = [];
    },
  },
});

export const {
  addAlert,
  setAlerts,
  removeAlert,
  clearAlerts,
  updateNotificationSettings,
  markAlertAsRead,
  markAllAlertsAsRead,
  markAlertAsUnread,
  restoreDismissedAlerts,
  clearHistory,
} = alertsSlice.actions;

export default alertsSlice.reducer;
