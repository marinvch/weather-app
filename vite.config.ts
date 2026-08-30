// defineConfig comes from vitest/config, not vite — that is what types the
// `test` block below. Vitest 4 dropped the /// <reference types="vitest" />
// form; using it here fails `tsc -b` with "'test' does not exist in type
// UserConfigExport". It is a superset of Vite's own defineConfig.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
          charts: ["recharts"],
          maps: ["leaflet"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["leaflet"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
