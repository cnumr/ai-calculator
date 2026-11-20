/**
 * Whether this browser has already taken (or dismissed) the guided tour, so
 * that its button stops inviting to it. Kept in this browser only, never sent
 * to the server. Storage may be unavailable (private mode, blocked site data):
 * the invitation is then simply shown, and nothing breaks.
 */
const STORAGE_KEY = "ai-calculator-tour-seen";

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Not stored: the invitation will show again next time, which is harmless.
  }
}
