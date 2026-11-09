import { UseCasesCatalog, fetchUseCases } from "./client";

/**
 * The catalogue, fetched once for the whole site and shared by the
 * calculator and the footer: navigating back to the calculator does not
 * fetch it again (eco-design, GreenIT RWEB_0021). A failed fetch is
 * forgotten, so that "Retry" fetches it again.
 */
let pending: Promise<UseCasesCatalog> | null = null;

export function loadCatalog(): Promise<UseCasesCatalog> {
  if (!pending) {
    pending = fetchUseCases().catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

/** Forgets the cached catalogue (tests). */
export function resetCatalogCache(): void {
  pending = null;
}
