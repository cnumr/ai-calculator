import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import i18next from "../i18n";
import tourFr from "../i18n/tour.fr.json";
import tourEn from "../i18n/tour.en.json";

// This module is loaded on demand, at the first click on "Guided tour"
// (React.lazy): its code and texts cost nothing to visitors who never take
// the tour (GreenIT RWEB_0046). Its texts join i18next once loaded.
i18next.addResourceBundle("fr", "tour", tourFr);
i18next.addResourceBundle("en", "tour", tourEn);

interface TourStep {
  /** Key of the step's texts (tour:steps.<id>). */
  id: string;
  /** data-tour attribute of the element the step is about. */
  target: string;
  /** The target belongs to a use case card: the example's, else the first. */
  inCard?: boolean;
  /**
   * data-tour attribute of the element to place the bubble under, when it
   * should not hide what follows the target (default: the target).
   */
  below?: string;
}

export const TOUR_STEPS: TourStep[] = [
  { id: "ecosystem", target: "ecosystem" },
  { id: "configure", target: "configure", inCard: true },
  { id: "frequency", target: "frequency", inCard: true },
  { id: "impacts", target: "impacts", inCard: true },
  { id: "onlyUsed", target: "only-used" },
  { id: "annualTotal", target: "individual-total" },
  // The bubble goes under the enterprise total, which it talks about.
  { id: "headcount", target: "headcount", below: "enterprise-total" },
  // Export and Import, outlined together.
  { id: "data", target: "data" },
  { id: "reset", target: "reset" },
];

/** The use case the steps tell about ("Writing a short email"). */
const EXAMPLE_USE_CASE = "email";
/** Space between the target and the bubble, and around the page edges. */
const GAP = 12;
const EDGE = 16;

function findTarget(step: TourStep): HTMLElement | null {
  const selector = `[data-tour="${step.target}"]`;
  if (step.inCard) {
    return (
      document.querySelector<HTMLElement>(
        `[data-use-case="${EXAMPLE_USE_CASE}"] ${selector}`,
      ) ?? document.querySelector<HTMLElement>(selector)
    );
  }
  return document.querySelector<HTMLElement>(selector);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

interface GuidedTourProps {
  /** The "Guided tour" button: the bubble falls back under it. */
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * Step-by-step tour of the calculator: a single bubble, moved from one real
 * element to the next, which it outlines. No library, no overlay, no
 * animation between steps; positions are computed once per step (and on
 * resize), never while scrolling.
 */
export default function GuidedTour({ anchor, onClose }: GuidedTourProps) {
  const { t } = useTranslation("tour");
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  // Above everything, sticky total included, where the Popover API exists.
  // The attribute is only set then: elsewhere it could hide the bubble.
  const showInTopLayer = useCallback((element: HTMLDivElement | null) => {
    bubbleRef.current = element;
    if (element && typeof element.showPopover === "function" && !element.matches(":popover-open")) {
      element.setAttribute("popover", "manual");
      element.showPopover();
    }
  }, []);

  // Under the target (or the tour button), in page coordinates, kept inside
  // the page width.
  const place = useCallback(() => {
    const bubble = bubbleRef.current;
    const target = findTarget(step);
    const under =
      (step.below && document.querySelector<HTMLElement>(`[data-tour="${step.below}"]`)) ||
      target ||
      anchor.current;
    if (!bubble || !under) return null;
    const rect = under.getBoundingClientRect();
    // What must be on screen: from the target (if any) down to the bubble.
    const top = Math.min(rect.top, (target ?? under).getBoundingClientRect().top);
    const width = bubble.offsetWidth;
    const minLeft = window.scrollX + EDGE;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - width - EDGE;
    const next = {
      top: rect.bottom + window.scrollY + GAP,
      left: Math.max(minLeft, Math.min(rect.left + window.scrollX, maxLeft)),
    };
    setPosition(next);
    return { next, top: top + window.scrollY };
  }, [anchor, step]);

  // Each step: outline its target, place the bubble, bring both into view
  // in one scroll, then move the focus to the bubble.
  useLayoutEffect(() => {
    const target = findTarget(step);
    target?.setAttribute("data-tour-active", "");
    const placed = place();
    const bubble = bubbleRef.current;
    if (placed && bubble) {
      const top = placed.top - GAP;
      const bottom = placed.next.top + bubble.offsetHeight + GAP;
      const viewTop = window.scrollY;
      const viewBottom = viewTop + window.innerHeight;
      if (top < viewTop || bottom > viewBottom) {
        // Tall pair: show its top; else centre it.
        const scrollTop =
          bottom - top > window.innerHeight ? top : top - (window.innerHeight - (bottom - top)) / 2;
        window.scrollTo?.({ top: scrollTop, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      }
    }
    bubble?.focus({ preventScroll: true });
    return () => target?.removeAttribute("data-tour-active");
  }, [step, place]);

  // One listener each: resize moves the bubble, Escape leaves the tour.
  useEffect(() => {
    const onResize = () => place();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [place, onClose]);

  const titleId = `${id}-title`;
  const progressId = `${id}-progress`;
  const bodyId = `${id}-body`;

  return (
    <div
      ref={showInTopLayer}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${progressId} ${titleId}`}
      aria-describedby={bodyId}
      tabIndex={-1}
      className="guided-tour"
      style={position ?? { visibility: "hidden" }}
    >
      <div className="guided-tour__header">
        <p id={progressId} className="guided-tour__progress">
          {t("progress", { current: index + 1, total: TOUR_STEPS.length })}
        </p>
        <button
          type="button"
          className="guided-tour__close"
          aria-label={t("close")}
          title={t("close")}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <h2 id={titleId} className="guided-tour__title">
        {t(`steps.${step.id}.title`)}
      </h2>
      <p id={bodyId} className="guided-tour__body">
        {t(`steps.${step.id}.body`)}
      </p>
      {last && (
        <p className="guided-tour__body">
          <Link to="/methodologie" onClick={onClose}>
            {t("steps.reset.link")}
          </Link>
        </p>
      )}
      <div className="guided-tour__nav">
        {index > 0 && (
          <button
            type="button"
            className="guided-tour__button"
            onClick={() => setIndex(index - 1)}
          >
            {t("previous")}
          </button>
        )}
        <button
          type="button"
          className="guided-tour__button guided-tour__button--primary"
          onClick={last ? onClose : () => setIndex(index + 1)}
        >
          {t(last ? "finish" : "next")}
        </button>
      </div>
    </div>
  );
}
