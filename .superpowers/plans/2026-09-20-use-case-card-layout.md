# Use-Case Card Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize each use-case card into a desktop two-column layout with a full-width detail toggle and a single-column mobile layout.

**Architecture:** Keep `UseCaseCard` as the sole component owning its form, primary impacts, and details. Add structural wrappers only where CSS grid placement requires them; no state, API, or calculation changes are needed. Use CSS media queries for the responsive collapse.

**Tech Stack:** React 19, TypeScript, CSS Grid, Vitest, Testing Library, Playwright.

## Global Constraints

- Each use-case card remains a single visual surface with no internal panel borders, backgrounds, or Parameters heading.
- On desktop, the form occupies the left column, GHG/water primary impacts occupy the right column, and the existing detail toggle spans both columns below.
- The existing detail-toggle appearance and behavior remain unchanged.
- On narrow screens, form, primary impacts, and detail toggle stack in source order.
- Existing labels, primary icon titles, calculations, requests, assets, and interactive controls remain unchanged.

---

### Task 1: Restructure And Style Use-Case Cards

**Files:**
- Modify: `frontend/tests/UseCaseCard.test.tsx`
- Modify: `frontend/e2e/catalogue.spec.ts`
- Modify: `frontend/src/components/UseCaseCard.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: existing `UseCaseCardProps` and `scaledImpacts` calculation without changes.
- Produces: `.use-case-card__form`, `.use-case-card__primary-impacts`, and existing `.use-case-card__details` as CSS-grid children.

- [ ] **Step 1: Write failing layout assertions**

Add a component test that renders `UseCaseCard` and asserts the form fields are inside `.use-case-card__form`, the summary is inside `.use-case-card__primary-impacts`, and the `<details>` element remains a direct child of `.use-case-card`. Add an E2E test at desktop viewport asserting the form and summary have the same top coordinate, while `<details>` starts below both.

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- tests/UseCaseCard.test.tsx && npm run test:e2e -- --grep "use-case card layout"`

Expected: FAIL because the required grouping classes do not exist.

- [ ] **Step 3: Add minimal semantic grouping**

In `UseCaseCard.tsx`, wrap the existing three field blocks in `<div className="use-case-card__form">`. Wrap the existing `dl.use-case-card__summary` in `<div className="use-case-card__primary-impacts">`. Keep the existing `<details className="use-case-card__details">` markup and summary text unchanged, after these two wrappers.

- [ ] **Step 4: Add the responsive grid rules**

In `index.css`, define a two-column grid for `.use-case-card`, keep the existing card visual properties, make `.use-case-card__form` a vertical grid, make `.use-case-card__primary-impacts` a vertical grid with the current two primary metrics, and apply `grid-column: 1 / -1` to `.use-case-card__details`. At `max-width: 640px`, set `.use-case-card` to one column and remove the details grid span.

- [ ] **Step 5: Run focused tests and build**

Run: `npm test -- tests/UseCaseCard.test.tsx && npm run test:e2e -- --grep "use-case card layout" && npm run build`

Expected: all focused checks pass and the production build succeeds.

- [ ] **Step 6: Run the full frontend verification**

Run: `npm test && npm run test:e2e`

Expected: all unit and E2E tests pass.

- [ ] **Step 7: Commit**

```bash
git add frontend/tests/UseCaseCard.test.tsx frontend/e2e/catalogue.spec.ts frontend/src/components/UseCaseCard.tsx frontend/src/index.css
git commit -m "feat(calculator): reorganize use case cards"
```

## Self-Review

- Spec coverage: Task 1 preserves the single card surface, desktop form/impact/toggle placement, mobile stacking, labels, icons, and detail behavior.
- Placeholder scan: no undefined functions, missing files, or deferred actions remain.
- Type consistency: existing `UseCaseCardProps` and impact calculations are unchanged.
