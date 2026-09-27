// defineConfig comes from vitest/config, not vite — that is what types the
// `test` block below. Vitest 4 dropped the /// <reference types="vitest" />
// form; using it here fails `tsc -b` with "'test' does not exist in type
// UserConfigExport". It is a superset of Vite's own defineConfig.
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the "@/*" paths entry in tsconfig.app.json. Both must agree, or
    // the type checker and the bundler disagree about what an import means.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2015",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          redux: ["@reduxjs/toolkit", "react-redux"],
          // No `charts: ["recharts"]` entry, on purpose. Recharts shares small
          // helpers with MUI; a manual chunk pulls those in with it, so the
          // main bundle had to preload all ~320 kB of chart code to reach
          // them. Left alone, Rollup puts recharts in an async chunk that
          // only the dashboards drawing a chart ever request.
          maps: ["leaflet"],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "leaflet",
      // Pre-bundle MUI and Emotion as whole units. Source code imports deep
      // paths (`@mui/material/Card`) for tree-shaking, and without these lines
      // Vite optimises each of the ~54 deep paths as its own entry. The shared
      // chunks it generates then reference Emotion both with and without the
      // `?v=` cache-busting query, which loads two instances of it — two React
      // contexts, and every MUI component dies with "Invalid hook call".
      // Dev-only: this does not affect the production build.
      "@mui/material",
      "@mui/material/styles",
      "@mui/icons-material",
      "@emotion/react",
      "@emotion/styled",
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Each worker builds its own jsdom and loads MUI + Emotion into it, which
    // is heavy. An unbounded pool has been observed exhausting the heap
    // ("Zone Allocation failed") when the machine is already busy. Capping
    // workers keeps peak memory bounded; the suite is small enough that the
    // lost parallelism costs a second or two.
    maxWorkers: 2,
  },
});
