import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri sets this when developing against a physical device.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // MapLibre ships an ESM worker; Vite's dep pre-bundling breaks its URL.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  // Tauri expects a fixed port and owns the terminal output.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    // WKWebView on macOS 12+; keep the bundle modern.
    target: "safari16",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
