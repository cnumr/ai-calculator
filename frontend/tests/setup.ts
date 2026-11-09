import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// The catalogue is cached for the whole site: start each test afresh.
// Imported lazily so that each test file's vi.mock of the API client applies
// to the store (a static import here would load the real client first).
afterEach(async () => {
  const { resetCatalogCache } = await import("../src/api/catalogStore");
  resetCatalogCache();
});
