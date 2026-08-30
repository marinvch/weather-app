import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

// API imports
import { weatherApi } from "@/shared/api/weatherApi";
import { marineApi } from "@/shared/api/marineApi";
import { historicalApi } from "@/shared/api/historicalApi";
import { agriculturalApi } from "@/shared/api/agriculturalApi";

// Slice imports
import userProfileReducer from "@/store/slices/userProfileSlice";
import preferencesReducer from "@/store/slices/preferencesSlice";
import alertsReducer from "@/features/alerts/store/alertsSlice";

export const store = configureStore({
  reducer: {
    // API reducers
    [weatherApi.reducerPath]: weatherApi.reducer,
    [marineApi.reducerPath]: marineApi.reducer,
    [historicalApi.reducerPath]: historicalApi.reducer,
    [agriculturalApi.reducerPath]: agriculturalApi.reducer,

    // Feature reducers
    userProfile: userProfileReducer,
    preferences: preferencesReducer,
    alerts: alertsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          // Ignore these action types
          "persist/FLUSH",
          "persist/REHYDRATE",
          "persist/PAUSE",
          "persist/PERSIST",
          "persist/PURGE",
          "persist/REGISTER",
        ],
      },
    })
      .concat(weatherApi.middleware)
      .concat(marineApi.middleware)
      .concat(historicalApi.middleware)
      .concat(agriculturalApi.middleware),
});

// Setup listeners for refetchOnFocus/refetchOnReconnect behavior
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
