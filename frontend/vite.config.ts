import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

export default defineConfig({
  plugins: [react()],
  // Site version shown in the footer, kept in sync by Changesets
  // (scripts/sync-versions.mjs): written into the bundle, no request needed.
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  server: {
    allowedHosts: [".orb.local"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
