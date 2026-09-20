# Calculator Results And Use-Case Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clear annual-result context and catalogue-driven use-case explanations without changing EcoLogits calculations.

**Architecture:** Keep aggregation in `CalculatorPage` and extract presentational result components only for the GHG summary and provider shares. Extend the existing catalogue contract with localized metadata, mapped once by the API client and rendered by `UseCaseCard`. Reset reuses the initial catalogue-derived state rather than adding persistence.

**Tech Stack:** FastAPI, Pydantic, PyYAML, React, TypeScript, react-i18next, Vitest, Playwright.

## Global Constraints

- EcoLogits remains the sole source for computed text impacts.
- Image and video static impacts remain unchanged.
- GHG, provider share, and equivalence information must have text values; colour and bars are supplementary.
- No new dependency, API request, asset, animation, or persistence is added.
- Cards retain the approved two-column, single-surface layout.

---

### Task 1: Result Summary And Reset

**Files:**
- Create: `frontend/src/components/GwpSummary.tsx`
- Modify: `frontend/src/pages/CalculatorPage.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/i18n/fr.json`
- Modify: `frontend/src/i18n/en.json`
- Test: `frontend/tests/CalculatorPage.test.tsx`

- [ ] Write failing tests for a localized annual GHG range, `218`-day note, and reset restoring default state.
- [ ] Implement `GwpSummary` using existing `scaleRange`, `formatNumber`, and `Co2Equivalents`; add reset by rebuilding catalogue defaults in `CalculatorPage`.
- [ ] Verify `npm test -- tests/CalculatorPage.test.tsx` passes.

### Task 2: Provider Shares And Enterprise Hierarchy

**Files:**
- Modify: `frontend/src/pages/CalculatorPage.tsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/tests/CalculatorPage.test.tsx`

- [ ] Write failing tests for provider percentage text, zero total handling, and enterprise GHG summary.
- [ ] Compute provider shares from existing annual GWP maxima; render an accessible `<meter>` with accompanying localized amount and percentage; place `GwpSummary` before both detailed grids.
- [ ] Verify targeted frontend tests pass.

### Task 3: Catalogue Context And Cards

**Files:**
- Modify: `backend/src/ai_calculator/data/use_cases.yaml`
- Modify: `backend/src/ai_calculator/domain/use_cases.py`
- Modify: `backend/src/ai_calculator/schemas/use_cases.py`
- Modify: `backend/src/ai_calculator/api/use_cases.py`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/components/UseCaseCard.tsx`
- Modify: `frontend/src/i18n/fr.json`
- Modify: `frontend/src/i18n/en.json`
- Test: `backend/tests/integration/test_use_cases_api.py`
- Test: `frontend/tests/UseCaseCard.test.tsx`

- [ ] Write failing API/component tests for subtitle and profile explanation metadata.
- [ ] Add translation keys to YAML, serialize and map them, then render the localized subtitle and selected-profile explanation without changing selectors, impacts, or detail toggle.
- [ ] Verify backend and focused frontend tests pass.

### Task 4: Full Verification

- [ ] Run `uv run pytest tests -q` from `backend`.
- [ ] Run `npm test && npm run test:e2e && npm run build` from `frontend`.
- [ ] Inspect desktop and mobile layouts, reset behavior, and provider percentage labels in the browser.

## Self-Review

- Result hierarchy, reset, provider shares, enterprise summary, catalogue context, localization, and accessibility have dedicated tasks.
- No impact values are added to contextual metadata.
- All derived quantities reuse existing ranges and aggregation functions.
