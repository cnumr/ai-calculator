import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";
import { appVersion } from "./src/appVersion";

export default defineConfig({
  plugins: [react()],
  // Site version shown in the footer, kept in sync by Changesets
  // (scripts/sync-versions.mjs): written into the bundle, no request needed.
  // APP_BUILD (Docker build arg) adds the commit on staging images.
  define: {
    __APP_VERSION__: JSON.stringify(appVersion(packageJson.version, process.env.APP_BUILD)),
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
