import { useEffect, useState } from "react";
import { CalculateRequest, CalculateResult, calculate } from "../api/client";

export type CalculationStatus = "idle" | "loading" | "error";

/** Wait this long after the last change before calling the backend. */
export const CALCULATION_DELAY_MS = 150;

/**
 * Runs POST /api/calculate for the current scenario.
 *
 * - Debounced: typing a frequency sends one request, not one per keystroke.
 * - Only the latest scenario's answer is applied: a newer scenario aborts
 *   the previous request, so a slow stale response never overwrites a newer
 *   one.
 * - The last result stays available while recalculating or after an error.
 */
export function useCalculation(request: CalculateRequest | null) {
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [status, setStatus] = useState<CalculationStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  // The request's content is the effect key: an identical scenario
  // (e.g. a re-render) does not trigger a new calculation.
  const key = request ? JSON.stringify(request) : null;

  useEffect(() => {
    if (key === null) return;
    const scenario: CalculateRequest = JSON.parse(key);
    const controller = new AbortController();
    setStatus("loading");
    const timer = setTimeout(() => {
      calculate(scenario, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setResult(next);
          setStatus("idle");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setStatus("error");
        });
    }, CALCULATION_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt]);

  return {
    result,
    status,
    retry: () => setAttempt((n) => n + 1),
  };
}
