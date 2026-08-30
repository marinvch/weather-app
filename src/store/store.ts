import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";

// API imports
import { weatherApi } from "./api/weatherApi";
import { marineApi } from "./api/marineApi";
import { historicalApi } from "./api/historicalApi";
import { agriculturalApi } from "./api/agriculturalApi";

// Slice imports
import userProfileReducer from "./slices/userProfileSlice";
import preferencesReducer from "./slices/preferencesSlice";
import alertsReducer from "./slices/alertsSlice";

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
