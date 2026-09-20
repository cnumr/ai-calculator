# Use-Case Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize calculator cards with their configured provider and profile defaults and annualize impacts over 218 working days.

**Architecture:** Extend the existing catalogue response rather than introducing a separate defaults endpoint. The frontend client maps the two fields and `CalculatorPage` consumes them only while creating initial card state. EcoLogits calculations and static image/video impacts remain unchanged.

**Tech Stack:** FastAPI, Pydantic, Python pytest, React, TypeScript, Vitest.

## Global Constraints

- Text impact values continue to be calculated by EcoLogits; legacy hard-coded POC values are not added.
- Image and video static impacts are unchanged.
- No new request, dependency, interactive control, or visual change is added.
- Existing accessible labels and form behavior remain unchanged.
- Annualization uses exactly 218 working days.

---

### Task 1: Expose Catalogue Defaults

**Files:**
- Modify: `backend/src/ai_calculator/schemas/use_cases.py`
- Modify: `backend/src/ai_calculator/api/use_cases.py`
- Modify: `backend/tests/integration/test_use_cases_api.py`

**Interfaces:**
- Produces: `UseCaseOut.default_provider: str` and `UseCaseOut.recommended_tier: str` from YAML-resolved use cases.

- [ ] **Step 1: Write a failing API test**

Add an assertion to `test_get_use_cases_returns_200_with_providers_and_use_cases`:

```python
email = next(item for item in body["use_cases"] if item["id"] == "email")
assert email["default_provider"] == "microsoft_copilot"
assert email["recommended_tier"] == "eco"
```

- [ ] **Step 2: Verify it fails**

Run: `pytest backend/tests/integration/test_use_cases_api.py -q`

Expected: FAIL with missing `default_provider`.

- [ ] **Step 3: Add the response fields**

Add `default_provider` and `recommended_tier` to `ResolvedUseCase` and `UseCaseOut`. Populate them while loading YAML and returning the API response.

- [ ] **Step 4: Verify the API test passes**

Run: `pytest backend/tests/integration/test_use_cases_api.py -q`

Expected: PASS.

### Task 2: Initialize Cards With Catalogue Defaults

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/pages/CalculatorPage.tsx`
- Modify: `frontend/tests/CalculatorPage.test.tsx`

**Interfaces:**
- Consumes: `default_provider` and `recommended_tier` from `UseCasesResponseBody`.
- Produces: `UseCase.defaultProviderId: string` and `UseCase.recommendedProfileId: string`.

- [ ] **Step 1: Write failing frontend tests**

Extend the `CATALOG` fixture with `default_provider: "microsoft_copilot"` and `recommended_tier: "eco"` for email. Assert the email card initializes its provider select to Microsoft Copilot. Add an aggregate assertion that a daily value of one is multiplied by 218.

- [ ] **Step 2: Verify they fail**

Run: `npm test -- tests/CalculatorPage.test.tsx`

Expected: FAIL because the client type has no defaults and initialization uses the first mapping.

- [ ] **Step 3: Map and consume defaults**

Map the API defaults in `fetchUseCases`. In `CalculatorPage`, choose the mapping whose provider matches `defaultProviderId`, and profile whose id matches `recommendedProfileId`; retain the current first-available fallback for incomplete catalogue data. Replace `WORKING_DAYS_PER_YEAR = 220` with `218`.

- [ ] **Step 4: Verify focused frontend tests pass**

Run: `npm test -- tests/CalculatorPage.test.tsx`

Expected: PASS.

### Task 3: Verify The Complete Change

**Files:**
- Modify: `.superpowers/specs/2026-09-20-use-case-defaults-design.md`
- Modify: `.superpowers/plans/2026-09-20-use-case-defaults.md`

- [ ] **Step 1: Run all backend tests**

Run: `pytest backend/tests -q`

Expected: PASS.

- [ ] **Step 2: Run full frontend verification**

Run: `npm test && npm run build && npm run test:e2e`

Expected: all tests pass and the production build succeeds.

- [ ] **Step 3: Verify defaults through the running API and page**

Load `/api/use-cases`; verify email exposes `microsoft_copilot` / `eco` and deep research exposes `openai` / `research`. Load the calculator and verify the corresponding selected controls.

## Self-Review

- Spec coverage: API data, frontend initialization, fallback behavior, annualization, and tests are covered.
- Placeholder scan: no deferred work or undefined interfaces remain.
- Type consistency: API snake_case fields map once to frontend camelCase fields.
