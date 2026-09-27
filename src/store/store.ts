import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { openMeteoApi } from "@/shared/api/openMeteoApi";
import { marineBaseApi } from "@/shared/api/marineBaseApi";
import { archiveApi } from "@/shared/api/archiveApi";
import { airQualityApi } from "@/shared/api/airQualityApi";
import { geocodingApi } from "@/shared/api/geocodingApi";
import { floodApi } from "@/shared/api/floodApi";

import userProfileReducer from "@/store/slices/userProfileSlice";
import preferencesReducer from "@/store/slices/preferencesSlice";
import alertsReducer from "@/features/alerts/store/alertsSlice";
import {
  loadPersistedState,
  savePersistedState,
  type PersistableState,
} from "@/store/persistence";

/**
 * One API per Open-Meteo host, not one per persona. Features add their own
 * endpoints with `injectEndpoints`, so adding a feature never means editing
 * this file — which is what keeps features deletable.
 *
 * Each API still needs BOTH its reducer and its middleware. Omitting the
 * middleware raises no error; the queries just never fire.
 *
 * The six hosts, in the order they appear below:
 *
 * | API | Host | reducerPath |
 * |---|---|---|
 * | `openMeteoApi`   | `api.`              | `openMeteo` |
 * | `marineBaseApi`  | `marine-api.`       | `marine`    |
 * | `archiveApi`     | `archive-api.`      | `archive`   |
 * | `airQualityApi`  | `air-quality-api.`  | `airQuality`|
 * | `geocodingApi`   | `geocoding-api.`    | `geocoding` |
 * | `floodApi`       | `flood-api.`        | `flood`     |
 */

/**
 * Writes the preference slices to localStorage. Prepended, not concatenated:
 * the listener middleware is documented to run before anything that might
 * short-circuit an action, and it reads state *after* the reducer either way.
 *
 * Only the two preference slices are persisted — never the RTK Query caches,
 * which is why this is a targeted listener rather than a store-wide subscriber.
 * See `@/store/persistence` for the allow-list and the hydration guards.
 */
const persistenceListener = createListenerMiddleware<PersistableState>();

persistenceListener.startListening({
  // A type prefix rather than a list of actions: a reducer added to either
  // slice tomorrow is persisted without anyone remembering to edit this line.
  // The write is small and these actions are all user-initiated, so there is
  // nothing here worth debouncing.
  predicate: (action) =>
    typeof action.type === "string" &&
    (action.type.startsWith("userProfile/") ||
      action.type.startsWith("preferences/")),
  effect: (_action, listenerApi) => {
    savePersistedState(listenerApi.getState());
  },
});

export const store = configureStore({
  reducer: {
    [openMeteoApi.reducerPath]: openMeteoApi.reducer,
    [marineBaseApi.reducerPath]: marineBaseApi.reducer,
    [archiveApi.reducerPath]: archiveApi.reducer,
    [airQualityApi.reducerPath]: airQualityApi.reducer,
    [geocodingApi.reducerPath]: geocodingApi.reducer,
    [floodApi.reducerPath]: floodApi.reducer,

    userProfile: userProfileReducer,
    preferences: preferencesReducer,
    alerts: alertsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(persistenceListener.middleware)
      .concat(openMeteoApi.middleware)
      .concat(marineBaseApi.middleware)
      .concat(archiveApi.middleware)
      .concat(airQualityApi.middleware)
      .concat(geocodingApi.middleware)
      .concat(floodApi.middleware),
  // Preferences from the last visit. Never partial and never throws: a
  // malformed or outdated blob resolves to the slices' own initial state.
  preloadedState: loadPersistedState(),
});

// Enables refetchOnFocus / refetchOnReconnect.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
