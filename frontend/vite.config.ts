import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";
import { appVersion } from "./src/appVersion";

// Ecoindex badge of each page in development: the same two addresses as
// nginx in production (nginx.conf.template), when ECOINDEX_DOMAIN is set.
// Without it the footer shows no badge.
const ecoindexDomain = process.env.ECOINDEX_DOMAIN;
const ECOINDEX_PAGES = ["/", "/methodologie", "/a-propos", "/mentions-legales"];

/** Path on bff.ecoindex.fr for the page in ?path=, or a 404 path. */
function ecoindexPath(endpoint: string, requestPath: string) {
  const page = new URL(requestPath, "http://dev").searchParams.get("path") ?? "";
  if (!ECOINDEX_PAGES.includes(page)) return "/not-a-page";
  const url = encodeURIComponent(`https://${ecoindexDomain}${page}`);
  return endpoint === "badge" ? `/badge/?theme=light&url=${url}` : `/redirect/?url=${url}`;
}

const ecoindexProxy = ecoindexDomain
  ? {
      "^/ecoindex-badge\\.svg": {
        target: "https://bff.ecoindex.fr",
        changeOrigin: true,
        rewrite: (path: string) => ecoindexPath("badge", path),
      },
      "^/ecoindex(\\?|$)": {
        target: "https://bff.ecoindex.fr",
        changeOrigin: true,
        rewrite: (path: string) => ecoindexPath("redirect", path),
      },
    }
  : undefined;

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
    proxy: ecoindexProxy,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
});
