import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

import { openMeteoApi } from "@/shared/api/openMeteoApi";
import { marineBaseApi } from "@/shared/api/marineBaseApi";
import { archiveApi } from "@/shared/api/archiveApi";

import userProfileReducer from "@/store/slices/userProfileSlice";
import preferencesReducer from "@/store/slices/preferencesSlice";
import alertsReducer from "@/features/alerts/store/alertsSlice";

/**
 * One API per Open-Meteo host, not one per persona. Features add their own
 * endpoints with `injectEndpoints`, so adding a feature never means editing
 * this file — which is what keeps features deletable.
 *
 * Each API still needs BOTH its reducer and its middleware. Omitting the
 * middleware raises no error; the queries just never fire.
 */
export const store = configureStore({
  reducer: {
    [openMeteoApi.reducerPath]: openMeteoApi.reducer,
    [marineBaseApi.reducerPath]: marineBaseApi.reducer,
    [archiveApi.reducerPath]: archiveApi.reducer,

    userProfile: userProfileReducer,
    preferences: preferencesReducer,
    alerts: alertsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(openMeteoApi.middleware)
      .concat(marineBaseApi.middleware)
      .concat(archiveApi.middleware),
});

// Enables refetchOnFocus / refetchOnReconnect.
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
