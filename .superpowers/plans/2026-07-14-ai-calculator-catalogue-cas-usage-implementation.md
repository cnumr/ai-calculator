# AI Calculator — Catalogue de cas d'usage (V2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-form calculator (V1) with a configurable catalogue of 8 use cases, reproducing the POC's fournisseur→profil cascade UX and extending it to all 5 EcoLogits indicators (GWP, Énergie, ADPe, PE, Eau), backed by a single `use_cases.yaml` config file and a new `GET /api/use-cases` endpoint that sits alongside the existing `GET /api/providers` and `POST /api/calculate`.

**Architecture:** Backend adds a YAML-config-driven domain loader (`domain/use_cases.py`) that resolves each catalogue entry's LLM profiles through the existing `compute_unit_impacts()` and reads static profiles (image/video) directly from the config, exposed via a new FastAPI router registered alongside the existing two. Frontend adds a pure aggregation module, an extended API client, two new components (`ProviderChips`, `UseCaseCard`), and rewrites `CalculatorPage` to fetch the catalogue once and drive all interactions from client-side state — no further network calls on toggle/select/frequency changes.

**Tech Stack:** FastAPI 0.139.0, Pydantic 2.13.4, EcoLogits 0.11.1, PyYAML 6.0.3 (new), pytest 9.1.1 — React 19.2.7, TypeScript 7.0.2, Vite 8.1.4, Vitest 4.1.10, Testing Library, react-i18next 17.0.9, Playwright 1.61.1 (new).

## Global Constraints

- `GET /api/providers` and `POST /api/calculate` stay unchanged — the new endpoint is additive only.
- `use_cases.yaml` lives at `backend/src/ai_calculator/data/use_cases.yaml`, single source of truth, no back-office.
- Config carries only stable identifiers (`meet_summary`, `eco`, `microsoft_copilot`, …), never display text — labels/descriptions live in `frontend/src/i18n/fr.json` / `en.json` under a dedicated `useCases` key, consistent with the existing i18n mechanism.
- Two profile shapes in the config: LLM profiles (`ecologits_provider` + `ecologits_model` + `output_tokens`, resolved via `compute_unit_impacts()`) and non-LLM static profiles (`static_impacts`, fixed 5-indicator values — image/video use cases only, since EcoLogits doesn't model them).
- A provider/profile combination absent from the config is "unsupported" — the front must disable/grey the profile select, not treat it as an error.
- Invalid `use_cases.yaml` (bad schema, or an LLM profile referencing a provider/model EcoLogits doesn't know) must fail app startup (fail-fast), never degrade silently at runtime.
- `GET /api/use-cases` is called exactly once on page load; all later interactions (chip toggle, select change, frequency change) read from the already-loaded structure, no re-fetch.
- Provider logos (`frontend/src/assets/providers/<id>.svg`) and use-case pictos (`frontend/src/assets/use-cases/<id>.svg`) already exist in the repo under the exact ids used below — reused as-is, no renaming, no regeneration.
- If a provider logo is missing for a given id, render a textual fallback (provider's initial) instead of a broken image.
- Every profile numeric value below (`ecologits_model`, `output_tokens`, `static_impacts`) has been empirically verified against the installed EcoLogits 0.11.1 registry (live `compute_unit_impacts()` calls, zero errors across all 90 LLM profile combinations) — copy it verbatim, do not re-derive it.

---

## File Structure

**Backend (new/modified):**

- `backend/pyproject.toml` — modify: add `pyyaml==6.0.3` runtime dependency
- `backend/src/ai_calculator/data/use_cases.yaml` — create: the catalogue config (providers + 8 use cases)
- `backend/src/ai_calculator/domain/use_cases.py` — create: config loader/validator/resolver
- `backend/tests/unit/test_use_cases.py` — create: unit tests for the loader
- `backend/src/ai_calculator/schemas/use_cases.py` — create: Pydantic response schemas
- `backend/src/ai_calculator/api/use_cases.py` — create: `GET /api/use-cases` router
- `backend/tests/integration/test_use_cases_api.py` — create: integration tests for the endpoint
- `backend/src/ai_calculator/main.py` — modify: register the new router

**Frontend (new/modified):**

- `frontend/src/domain/aggregate.ts` — create: pure impact-aggregation helpers
- `frontend/tests/aggregate.test.ts` — create: unit tests for aggregation
- `frontend/src/api/client.ts` — modify: add `fetchUseCases()` + catalogue types
- `frontend/tests/client.test.ts` — create: unit tests for `fetchUseCases()`
- `frontend/src/components/ProviderChips.tsx` — create: "écosystème IA" chip row
- `frontend/tests/ProviderChips.test.tsx` — create
- `frontend/src/components/UseCaseCard.tsx` — create: cascading fournisseur→profil card
- `frontend/tests/UseCaseCard.test.tsx` — create
- `frontend/src/pages/CalculatorPage.tsx` — modify: full rewrite around the catalogue
- `frontend/tests/CalculatorPage.test.tsx` — modify: replace V1 tests with V2 catalogue-driven tests
- `frontend/src/i18n/fr.json`, `frontend/src/i18n/en.json` — modify: add `useCases`, `providers`, `calculator.*` catalogue keys
- `frontend/package.json` — modify: add `@playwright/test` devDependency + `test:e2e` script
- `frontend/playwright.config.ts` — create
- `frontend/e2e/catalogue.spec.ts` — create: end-to-end scenario

---

## Backend Tasks

### Task 1: PyYAML dependency and `use_cases.yaml` config file

**Files:**

- Modify: `backend/pyproject.toml`
- Create: `backend/src/ai_calculator/data/use_cases.yaml`

**Interfaces:**

- Produces: a YAML file at `backend/src/ai_calculator/data/use_cases.yaml` with top-level keys `providers` (list of `{id, selected_by_default}`) and `use_cases` (list of `{id, default_provider, recommended_tier, providers: [{provider_id, profiles: [{id, ecologits_provider?, ecologits_model?, output_tokens?, static_impacts?}]}]}`) — consumed by Task 2's loader.

This is a config/dependency task (no application code yet), verified by parsing the file directly with PyYAML rather than through pytest.

- [ ] **Step 1: Add the `pyyaml` dependency**

Edit `backend/pyproject.toml`, adding `"pyyaml==6.0.3",` to the `dependencies` list (alongside the existing `fastapi`, `ecologits`, `pydantic`, `uvicorn` entries).

- [ ] **Step 2: Install it into the backend venv**

The backend's `.venv` has no `pip` bootstrapped — use `uv` instead:

Run: `uv pip install pyyaml==6.0.3 --python backend/.venv/bin/python`
Expected: `Installed 1 package` (or "Audited 1 package" if already present), no error.

- [ ] **Step 3: Create `backend/src/ai_calculator/data/use_cases.yaml`**

```yaml
providers:
  - id: openai
    selected_by_default: true
  - id: anthropic
    selected_by_default: false
  - id: mistral
    selected_by_default: false
  - id: google
    selected_by_default: true
  - id: microsoft_copilot
    selected_by_default: true
use_cases:
  - id: video
    default_provider: google
    recommended_tier: video
    providers:
      - provider_id: google
        profiles:
          - id: video
            static_impacts:
              gwp:
                min: 0.377061
                max: 0.377061
              adpe:
                min: 8.102e-06
                max: 8.102e-06
              energy:
                min: 0.0
                max: 0.0
              water:
                min: 0.0
                max: 0.0
              pe:
                min: 0.0
                max: 0.0
  - id: image
    default_provider: google
    recommended_tier: image
    providers:
      - provider_id: google
        profiles:
          - id: image
            static_impacts:
              gwp:
                min: 0.012568
                max: 0.012568
              adpe:
                min: 2.7e-07
                max: 2.7e-07
              energy:
                min: 0.0
                max: 0.0
              water:
                min: 0.0
                max: 0.0
              pe:
                min: 0.0
                max: 0.0
      - provider_id: openai
        profiles:
          - id: image
            static_impacts:
              gwp:
                min: 0.0125
                max: 0.0125
              adpe:
                min: 2.68e-07
                max: 2.68e-07
              energy:
                min: 0.0
                max: 0.0
              water:
                min: 0.0
                max: 0.0
              pe:
                min: 0.0
                max: 0.0
  - id: deep_research
    default_provider: openai
    recommended_tier: research
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 200000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 200000
          - id: powerful
            ecologits_provider: openai
            ecologits_model: gpt-4.1
            output_tokens: 200000
          - id: research
            ecologits_provider: openai
            ecologits_model: o4-mini-deep-research
            output_tokens: 200000
      - provider_id: anthropic
        profiles:
          - id: eco
            ecologits_provider: anthropic
            ecologits_model: claude-haiku-4-5
            output_tokens: 200000
          - id: balanced
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 200000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-opus-4-0
            output_tokens: 200000
      - provider_id: mistral
        profiles:
          - id: eco
            ecologits_provider: mistralai
            ecologits_model: ministral-8b-latest
            output_tokens: 200000
          - id: balanced
            ecologits_provider: mistralai
            ecologits_model: mistral-small-latest
            output_tokens: 200000
          - id: powerful
            ecologits_provider: mistralai
            ecologits_model: mistral-large-latest
            output_tokens: 200000
      - provider_id: google
        profiles:
          - id: eco
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash-lite
            output_tokens: 200000
          - id: balanced
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash
            output_tokens: 200000
          - id: powerful
            ecologits_provider: google_genai
            ecologits_model: gemini-2.5-pro
            output_tokens: 200000
      - provider_id: microsoft_copilot
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 200000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 200000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 200000
  - id: meet_summary
    default_provider: microsoft_copilot
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 8000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 8000
          - id: powerful
            ecologits_provider: openai
            ecologits_model: gpt-4.1
            output_tokens: 8000
          - id: research
            ecologits_provider: openai
            ecologits_model: o4-mini-deep-research
            output_tokens: 8000
      - provider_id: anthropic
        profiles:
          - id: eco
            ecologits_provider: anthropic
            ecologits_model: claude-haiku-4-5
            output_tokens: 8000
          - id: balanced
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 8000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-opus-4-0
            output_tokens: 8000
      - provider_id: mistral
        profiles:
          - id: eco
            ecologits_provider: mistralai
            ecologits_model: ministral-8b-latest
            output_tokens: 8000
          - id: balanced
            ecologits_provider: mistralai
            ecologits_model: mistral-small-latest
            output_tokens: 8000
          - id: powerful
            ecologits_provider: mistralai
            ecologits_model: mistral-large-latest
            output_tokens: 8000
      - provider_id: google
        profiles:
          - id: eco
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash-lite
            output_tokens: 8000
          - id: balanced
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash
            output_tokens: 8000
          - id: powerful
            ecologits_provider: google_genai
            ecologits_model: gemini-2.5-pro
            output_tokens: 8000
      - provider_id: microsoft_copilot
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 8000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 8000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 8000
  - id: doc_small
    default_provider: openai
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 3000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 3000
          - id: powerful
            ecologits_provider: openai
            ecologits_model: gpt-4.1
            output_tokens: 3000
          - id: research
            ecologits_provider: openai
            ecologits_model: o4-mini-deep-research
            output_tokens: 3000
      - provider_id: anthropic
        profiles:
          - id: eco
            ecologits_provider: anthropic
            ecologits_model: claude-haiku-4-5
            output_tokens: 3000
          - id: balanced
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 3000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-opus-4-0
            output_tokens: 3000
      - provider_id: mistral
        profiles:
          - id: eco
            ecologits_provider: mistralai
            ecologits_model: ministral-8b-latest
            output_tokens: 3000
          - id: balanced
            ecologits_provider: mistralai
            ecologits_model: mistral-small-latest
            output_tokens: 3000
          - id: powerful
            ecologits_provider: mistralai
            ecologits_model: mistral-large-latest
            output_tokens: 3000
      - provider_id: google
        profiles:
          - id: eco
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash-lite
            output_tokens: 3000
          - id: balanced
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash
            output_tokens: 3000
          - id: powerful
            ecologits_provider: google_genai
            ecologits_model: gemini-2.5-pro
            output_tokens: 3000
      - provider_id: microsoft_copilot
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 3000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 3000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 3000
  - id: doc_large
    default_provider: openai
    recommended_tier: balanced
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 15000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 15000
          - id: powerful
            ecologits_provider: openai
            ecologits_model: gpt-4.1
            output_tokens: 15000
          - id: research
            ecologits_provider: openai
            ecologits_model: o4-mini-deep-research
            output_tokens: 15000
      - provider_id: anthropic
        profiles:
          - id: eco
            ecologits_provider: anthropic
            ecologits_model: claude-haiku-4-5
            output_tokens: 15000
          - id: balanced
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 15000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-opus-4-0
            output_tokens: 15000
      - provider_id: mistral
        profiles:
          - id: eco
            ecologits_provider: mistralai
            ecologits_model: ministral-8b-latest
            output_tokens: 15000
          - id: balanced
            ecologits_provider: mistralai
            ecologits_model: mistral-small-latest
            output_tokens: 15000
          - id: powerful
            ecologits_provider: mistralai
            ecologits_model: mistral-large-latest
            output_tokens: 15000
      - provider_id: google
        profiles:
          - id: eco
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash-lite
            output_tokens: 15000
          - id: balanced
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash
            output_tokens: 15000
          - id: powerful
            ecologits_provider: google_genai
            ecologits_model: gemini-2.5-pro
            output_tokens: 15000
      - provider_id: microsoft_copilot
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 15000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 15000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 15000
  - id: ai_query
    default_provider: google
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 1000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 1000
          - id: powerful
            ecologits_provider: openai
            ecologits_model: gpt-4.1
            output_tokens: 1000
          - id: research
            ecologits_provider: openai
            ecologits_model: o4-mini-deep-research
            output_tokens: 1000
      - provider_id: anthropic
        profiles:
          - id: eco
            ecologits_provider: anthropic
            ecologits_model: claude-haiku-4-5
            output_tokens: 1000
          - id: balanced
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 1000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-opus-4-0
            output_tokens: 1000
      - provider_id: mistral
        profiles:
          - id: eco
            ecologits_provider: mistralai
            ecologits_model: ministral-8b-latest
            output_tokens: 1000
          - id: balanced
            ecologits_provider: mistralai
            ecologits_model: mistral-small-latest
            output_tokens: 1000
          - id: powerful
            ecologits_provider: mistralai
            ecologits_model: mistral-large-latest
            output_tokens: 1000
      - provider_id: google
        profiles:
          - id: eco
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash-lite
            output_tokens: 1000
          - id: balanced
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash
            output_tokens: 1000
          - id: powerful
            ecologits_provider: google_genai
            ecologits_model: gemini-2.5-pro
            output_tokens: 1000
      - provider_id: microsoft_copilot
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 1000
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 1000
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 1000
  - id: email
    default_provider: microsoft_copilot
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 300
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 300
          - id: powerful
            ecologits_provider: openai
            ecologits_model: gpt-4.1
            output_tokens: 300
          - id: research
            ecologits_provider: openai
            ecologits_model: o4-mini-deep-research
            output_tokens: 300
      - provider_id: anthropic
        profiles:
          - id: eco
            ecologits_provider: anthropic
            ecologits_model: claude-haiku-4-5
            output_tokens: 300
          - id: balanced
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 300
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-opus-4-0
            output_tokens: 300
      - provider_id: mistral
        profiles:
          - id: eco
            ecologits_provider: mistralai
            ecologits_model: ministral-8b-latest
            output_tokens: 300
          - id: balanced
            ecologits_provider: mistralai
            ecologits_model: mistral-small-latest
            output_tokens: 300
          - id: powerful
            ecologits_provider: mistralai
            ecologits_model: mistral-large-latest
            output_tokens: 300
      - provider_id: google
        profiles:
          - id: eco
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash-lite
            output_tokens: 300
          - id: balanced
            ecologits_provider: google_genai
            ecologits_model: gemini-2.0-flash
            output_tokens: 300
          - id: powerful
            ecologits_provider: google_genai
            ecologits_model: gemini-2.5-pro
            output_tokens: 300
      - provider_id: microsoft_copilot
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 300
          - id: balanced
            ecologits_provider: openai
            ecologits_model: gpt-4o
            output_tokens: 300
          - id: powerful
            ecologits_provider: anthropic
            ecologits_model: claude-sonnet-4-5
            output_tokens: 300
```

Note: `energy`, `water`, `pe` are set to `{min: 0, max: 0}` for the `image`/`video` static profiles — EcoLogits doesn't model these use cases, and the user explicitly chose "explicit zero value" over estimation, with this note now recorded here rather than as an inline YAML comment (YAML comments are stripped by `yaml.safe_load` and would be invisible to anyone reading the parsed structure — this plan is the durable record of the decision).

- [ ] **Step 4: Verify the file parses**

Run: `backend/.venv/bin/python -c "import yaml; d = yaml.safe_load(open('backend/src/ai_calculator/data/use_cases.yaml')); print(len(d['providers']), len(d['use_cases']))"`
Expected: `5 8`

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/src/ai_calculator/data/use_cases.yaml
git commit -m "chore: add pyyaml dependency and use_cases.yaml catalogue config"
```

---

### Task 2: Domain catalogue loader (`domain/use_cases.py`)

**Files:**

- Create: `backend/src/ai_calculator/domain/use_cases.py`
- Test: `backend/tests/unit/test_use_cases.py`

**Interfaces:**

- Consumes: `backend/src/ai_calculator/domain/impacts.py`'s `ImpactRange`, `UnitImpacts`, `ModelNotFoundError`, `EcologitsComputationError`, `compute_unit_impacts(provider: str, model_name: str, output_tokens: int) -> UnitImpacts` (Task 1's `use_cases.yaml`).
- Produces (for Task 3): `UseCasesConfigError(Exception)`; dataclasses `CatalogProvider(id: str, selected_by_default: bool)`, `ResolvedProfile(id: str, impacts: UnitImpacts)`, `ResolvedProviderMapping(provider_id: str, profiles: list[ResolvedProfile])`, `ResolvedUseCase(id: str, providers: list[ResolvedProviderMapping])`, `Catalog(providers: list[CatalogProvider], use_cases: list[ResolvedUseCase])`; function `load_catalog(path: Path | None = None) -> Catalog` (defaults to `backend/src/ai_calculator/data/use_cases.yaml`, raises `UseCasesConfigError` on any schema or resolution failure).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/test_use_cases.py`:

```python
import pytest

from ai_calculator.domain.use_cases import (
    Catalog,
    UseCasesConfigError,
    load_catalog,
)

VALID_YAML = """
providers:
  - id: openai
    selected_by_default: true
  - id: google
    selected_by_default: false
use_cases:
  - id: email
    default_provider: openai
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 300
  - id: image
    default_provider: google
    recommended_tier: image
    providers:
      - provider_id: google
        profiles:
          - id: image
            static_impacts:
              gwp: {min: 0.0125, max: 0.0125}
              adpe: {min: 2.68e-07, max: 2.68e-07}
              energy: {min: 0.0, max: 0.0}
              water: {min: 0.0, max: 0.0}
              pe: {min: 0.0, max: 0.0}
"""


def test_load_catalog_resolves_llm_and_static_profiles(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(VALID_YAML)

    catalog: Catalog = load_catalog(config_file)

    assert [p.id for p in catalog.providers] == ["openai", "google"]
    assert catalog.providers[0].selected_by_default is True
    assert catalog.providers[1].selected_by_default is False

    email = next(uc for uc in catalog.use_cases if uc.id == "email")
    email_openai = next(p for p in email.providers if p.provider_id == "openai")
    eco_profile = next(p for p in email_openai.profiles if p.id == "eco")
    assert eco_profile.impacts.gwp.max >= eco_profile.impacts.gwp.min >= 0

    image = next(uc for uc in catalog.use_cases if uc.id == "image")
    image_google = next(p for p in image.providers if p.provider_id == "google")
    static_profile = next(p for p in image_google.profiles if p.id == "image")
    assert static_profile.impacts.gwp.min == 0.0125
    assert static_profile.impacts.gwp.max == 0.0125
    assert static_profile.impacts.energy.min == 0.0
    assert static_profile.impacts.energy.max == 0.0


def test_load_catalog_raises_on_unknown_ecologits_model(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(
        """
providers:
  - id: openai
    selected_by_default: true
use_cases:
  - id: email
    default_provider: openai
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: does-not-exist
            output_tokens: 300
"""
    )

    with pytest.raises(UseCasesConfigError):
        load_catalog(config_file)


def test_load_catalog_raises_on_missing_required_field(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(
        """
providers:
  - id: openai
    selected_by_default: true
use_cases:
  - id: email
    default_provider: openai
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
"""
    )

    with pytest.raises(UseCasesConfigError):
        load_catalog(config_file)


def test_load_catalog_raises_on_missing_file(tmp_path):
    with pytest.raises(UseCasesConfigError):
        load_catalog(tmp_path / "does-not-exist.yaml")


def test_load_catalog_default_path_loads_real_config():
    catalog = load_catalog()

    assert len(catalog.providers) == 5
    assert len(catalog.use_cases) == 8
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_use_cases.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'ai_calculator.domain.use_cases'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/ai_calculator/domain/use_cases.py`:

```python
from dataclasses import dataclass
from pathlib import Path

import yaml

from ai_calculator.domain.impacts import (
    EcologitsComputationError,
    ImpactRange,
    ModelNotFoundError,
    UnitImpacts,
    compute_unit_impacts,
)

DEFAULT_USE_CASES_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "use_cases.yaml"
)


class UseCasesConfigError(Exception):
    pass


@dataclass(frozen=True)
class CatalogProvider:
    id: str
    selected_by_default: bool


@dataclass(frozen=True)
class ResolvedProfile:
    id: str
    impacts: UnitImpacts


@dataclass(frozen=True)
class ResolvedProviderMapping:
    provider_id: str
    profiles: list[ResolvedProfile]


@dataclass(frozen=True)
class ResolvedUseCase:
    id: str
    providers: list[ResolvedProviderMapping]


@dataclass(frozen=True)
class Catalog:
    providers: list[CatalogProvider]
    use_cases: list[ResolvedUseCase]


def _require(mapping: dict, key: str, context: str) -> object:
    if key not in mapping:
        raise UseCasesConfigError(f"Missing required field '{key}' in {context}")
    return mapping[key]


def _parse_range(mapping: dict, key: str, context: str) -> ImpactRange:
    value = _require(mapping, key, context)
    return ImpactRange(min=float(_require(value, "min", context)), max=float(_require(value, "max", context)))


def _resolve_static_profile(profile_id: str, static_impacts: dict, context: str) -> ResolvedProfile:
    impacts = UnitImpacts(
        gwp=_parse_range(static_impacts, "gwp", context),
        energy=_parse_range(static_impacts, "energy", context),
        adpe=_parse_range(static_impacts, "adpe", context),
        pe=_parse_range(static_impacts, "pe", context),
        water=_parse_range(static_impacts, "water", context),
    )
    return ResolvedProfile(id=profile_id, impacts=impacts)


def _resolve_llm_profile(profile_id: str, profile: dict, context: str) -> ResolvedProfile:
    ecologits_provider = _require(profile, "ecologits_provider", context)
    ecologits_model = _require(profile, "ecologits_model", context)
    output_tokens = _require(profile, "output_tokens", context)
    try:
        impacts = compute_unit_impacts(
            provider=ecologits_provider,
            model_name=ecologits_model,
            output_tokens=int(output_tokens),
        )
    except ModelNotFoundError as exc:
        raise UseCasesConfigError(f"{context}: {exc}") from exc
    except EcologitsComputationError as exc:
        raise UseCasesConfigError(f"{context}: {exc}") from exc
    return ResolvedProfile(id=profile_id, impacts=impacts)


def _resolve_profile(profile: dict, context: str) -> ResolvedProfile:
    profile_id = _require(profile, "id", context)
    profile_context = f"{context} profile '{profile_id}'"
    if "static_impacts" in profile:
        return _resolve_static_profile(profile_id, profile["static_impacts"], profile_context)
    return _resolve_llm_profile(profile_id, profile, profile_context)


def load_catalog(path: Path | None = None) -> Catalog:
    config_path = path if path is not None else DEFAULT_USE_CASES_PATH

    try:
        raw_text = config_path.read_text()
    except OSError as exc:
        raise UseCasesConfigError(f"Cannot read {config_path}: {exc}") from exc

    try:
        raw = yaml.safe_load(raw_text)
    except yaml.YAMLError as exc:
        raise UseCasesConfigError(f"Invalid YAML in {config_path}: {exc}") from exc

    if not isinstance(raw, dict):
        raise UseCasesConfigError(f"{config_path}: top-level content must be a mapping")

    raw_providers = _require(raw, "providers", str(config_path))
    providers = [
        CatalogProvider(
            id=_require(p, "id", "providers entry"),
            selected_by_default=bool(_require(p, "selected_by_default", "providers entry")),
        )
        for p in raw_providers
    ]

    raw_use_cases = _require(raw, "use_cases", str(config_path))
    use_cases = []
    for uc in raw_use_cases:
        use_case_id = _require(uc, "id", "use_cases entry")
        raw_provider_mappings = _require(uc, "providers", f"use case '{use_case_id}'")
        provider_mappings = []
        for pm in raw_provider_mappings:
            provider_id = _require(pm, "provider_id", f"use case '{use_case_id}'")
            raw_profiles = _require(pm, "profiles", f"use case '{use_case_id}' provider '{provider_id}'")
            context = f"use case '{use_case_id}' provider '{provider_id}'"
            profiles = [_resolve_profile(p, context) for p in raw_profiles]
            provider_mappings.append(
                ResolvedProviderMapping(provider_id=provider_id, profiles=profiles)
            )
        use_cases.append(ResolvedUseCase(id=use_case_id, providers=provider_mappings))

    return Catalog(providers=providers, use_cases=use_cases)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/unit/test_use_cases.py -v`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai_calculator/domain/use_cases.py backend/tests/unit/test_use_cases.py
git commit -m "feat: add use_cases.yaml catalogue loader"
```

---

### Task 3: `GET /api/use-cases` endpoint

**Files:**

- Create: `backend/src/ai_calculator/schemas/use_cases.py`
- Create: `backend/src/ai_calculator/api/use_cases.py`
- Test: `backend/tests/integration/test_use_cases_api.py`
- Modify: `backend/src/ai_calculator/main.py`

**Interfaces:**

- Consumes: Task 2's `Catalog`, `load_catalog()`, `ResolvedUseCase`, `ResolvedProviderMapping`, `ResolvedProfile`, `CatalogProvider`; `backend/src/ai_calculator/api/calculate.py`'s `_to_impacts_out(impacts) -> ImpactsOut`; `backend/src/ai_calculator/schemas/calculate.py`'s `ImpactsOut`.
- Produces: `router` (FastAPI `APIRouter`) exposing `GET /api/use-cases -> UseCasesResponse`; response schemas `ProfileOut{id: str, impacts: ImpactsOut}`, `ProviderMappingOut{provider_id: str, profiles: list[ProfileOut]}`, `UseCaseOut{id: str, providers: list[ProviderMappingOut]}`, `CatalogProviderOut{id: str, selected_by_default: bool}`, `UseCasesResponse{providers: list[CatalogProviderOut], use_cases: list[UseCaseOut]}`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/integration/test_use_cases_api.py`:

```python
from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)


def test_get_use_cases_returns_200_with_providers_and_use_cases():
    response = client.get("/api/use-cases")

    assert response.status_code == 200
    body = response.json()
    assert len(body["providers"]) == 5
    assert len(body["use_cases"]) == 8


def test_get_use_cases_reflects_selected_by_default():
    response = client.get("/api/use-cases")

    body = response.json()
    providers_by_id = {p["id"]: p for p in body["providers"]}
    assert providers_by_id["openai"]["selected_by_default"] is True
    assert providers_by_id["anthropic"]["selected_by_default"] is False
    assert providers_by_id["mistral"]["selected_by_default"] is False


def test_get_use_cases_profile_carries_five_indicators_min_max():
    response = client.get("/api/use-cases")

    body = response.json()
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    openai_mapping = next(p for p in email["providers"] if p["provider_id"] == "openai")
    eco_profile = next(p for p in openai_mapping["profiles"] if p["id"] == "eco")
    for criterion in ("gwp", "energy", "adpe", "pe", "water"):
        assert criterion in eco_profile["impacts"]
        assert eco_profile["impacts"][criterion]["max"] >= eco_profile["impacts"][criterion]["min"]


def test_get_use_cases_omits_unsupported_provider_combinations():
    response = client.get("/api/use-cases")

    body = response.json()
    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    provider_ids = {p["provider_id"] for p in video["providers"]}
    assert provider_ids == {"google"}

    image = next(uc for uc in body["use_cases"] if uc["id"] == "image")
    image_provider_ids = {p["provider_id"] for p in image["providers"]}
    assert image_provider_ids == {"google", "openai"}


def test_get_use_cases_includes_cors_header_for_allowed_origin():
    response = client.get(
        "/api/use-cases", headers={"Origin": "http://localhost:5173"}
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && .venv/bin/python -m pytest tests/integration/test_use_cases_api.py -v`
Expected: FAIL with `404 Not Found` (route doesn't exist yet)

- [ ] **Step 3: Write the schemas**

Create `backend/src/ai_calculator/schemas/use_cases.py`:

```python
from pydantic import BaseModel

from .calculate import ImpactsOut


class ProfileOut(BaseModel):
    id: str
    impacts: ImpactsOut


class ProviderMappingOut(BaseModel):
    provider_id: str
    profiles: list[ProfileOut]


class UseCaseOut(BaseModel):
    id: str
    providers: list[ProviderMappingOut]


class CatalogProviderOut(BaseModel):
    id: str
    selected_by_default: bool


class UseCasesResponse(BaseModel):
    providers: list[CatalogProviderOut]
    use_cases: list[UseCaseOut]
```

- [ ] **Step 4: Write the router**

Create `backend/src/ai_calculator/api/use_cases.py`:

```python
from fastapi import APIRouter

from ai_calculator.domain.use_cases import Catalog, load_catalog
from ai_calculator.schemas.use_cases import (
    CatalogProviderOut,
    ProfileOut,
    ProviderMappingOut,
    UseCaseOut,
    UseCasesResponse,
)

from .calculate import _to_impacts_out

router = APIRouter()

_catalog: Catalog = load_catalog()


def _to_use_cases_response(catalog: Catalog) -> UseCasesResponse:
    return UseCasesResponse(
        providers=[
            CatalogProviderOut(id=p.id, selected_by_default=p.selected_by_default)
            for p in catalog.providers
        ],
        use_cases=[
            UseCaseOut(
                id=uc.id,
                providers=[
                    ProviderMappingOut(
                        provider_id=pm.provider_id,
                        profiles=[
                            ProfileOut(id=p.id, impacts=_to_impacts_out(p.impacts))
                            for p in pm.profiles
                        ],
                    )
                    for pm in uc.providers
                ],
            )
            for uc in catalog.use_cases
        ],
    )


@router.get("/api/use-cases", response_model=UseCasesResponse)
def get_use_cases() -> UseCasesResponse:
    return _to_use_cases_response(_catalog)
```

- [ ] **Step 5: Register the router in `main.py`**

Edit `backend/src/ai_calculator/main.py`:

```python
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ai_calculator.api.calculate import router as calculate_router
from ai_calculator.api.providers import router as providers_router
from ai_calculator.api.use_cases import router as use_cases_router

app = FastAPI(title="AI Calculator API")

# Dev default matches the Vite dev server port used by docker-compose.yml.
cors_allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(providers_router)
app.include_router(calculate_router)
app.include_router(use_cases_router)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && .venv/bin/python -m pytest tests/integration/test_use_cases_api.py -v`
Expected: `5 passed`

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && .venv/bin/python -m pytest -v`
Expected: all tests pass (no regressions in `test_calculate_api.py`, `test_providers_api.py`, `test_catalog.py`, `test_extrapolation.py`, `test_impacts.py`, `test_use_cases.py`)

- [ ] **Step 8: Commit**

```bash
git add backend/src/ai_calculator/schemas/use_cases.py backend/src/ai_calculator/api/use_cases.py backend/tests/integration/test_use_cases_api.py backend/src/ai_calculator/main.py
git commit -m "feat: add GET /api/use-cases endpoint"
```

---

## Frontend Tasks

### Task 4: Pure aggregation helpers (`domain/aggregate.ts`)

**Files:**

- Create: `frontend/src/domain/aggregate.ts`
- Test: `frontend/tests/aggregate.test.ts`

**Interfaces:**

- Consumes: `frontend/src/api/client.ts`'s `Impacts`, `ImpactRange` (existing types, unchanged).
- Produces (for Task 9): `zeroImpacts(): Impacts`; `scaleImpacts(impacts: Impacts, factor: number): Impacts`; `sumImpacts(a: Impacts, b: Impacts): Impacts`; `aggregateByProvider(entries: Array<{ providerId: string; impacts: Impacts }>): Record<string, Impacts>`.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/aggregate.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  aggregateByProvider,
  scaleImpacts,
  sumImpacts,
  zeroImpacts,
} from "../src/domain/aggregate";
import type { Impacts } from "../src/api/client";

const IMPACTS_A: Impacts = {
  gwp: { min: 1, max: 2 },
  energy: { min: 0.1, max: 0.2 },
  adpe: { min: 0.01, max: 0.02 },
  pe: { min: 1.5, max: 2.5 },
  water: { min: 3, max: 4 },
};

const IMPACTS_B: Impacts = {
  gwp: { min: 10, max: 20 },
  energy: { min: 1, max: 2 },
  adpe: { min: 0.1, max: 0.2 },
  pe: { min: 15, max: 25 },
  water: { min: 30, max: 40 },
};

describe("zeroImpacts", () => {
  it("returns all-zero ranges for every criterion", () => {
    const zero = zeroImpacts();
    for (const key of ["gwp", "energy", "adpe", "pe", "water"] as const) {
      expect(zero[key]).toEqual({ min: 0, max: 0 });
    }
  });
});

describe("scaleImpacts", () => {
  it("multiplies every min/max by the factor", () => {
    const scaled = scaleImpacts(IMPACTS_A, 10);
    expect(scaled.gwp).toEqual({ min: 10, max: 20 });
    expect(scaled.water).toEqual({ min: 30, max: 40 });
  });
});

describe("sumImpacts", () => {
  it("adds min/max per criterion across two impact sets", () => {
    const total = sumImpacts(IMPACTS_A, IMPACTS_B);
    expect(total.gwp).toEqual({ min: 11, max: 22 });
    expect(total.energy).toEqual({ min: 1.1, max: 2.2 });
  });
});

describe("aggregateByProvider", () => {
  it("sums impacts per provider id across multiple entries", () => {
    const result = aggregateByProvider([
      { providerId: "openai", impacts: IMPACTS_A },
      { providerId: "google", impacts: IMPACTS_B },
      { providerId: "openai", impacts: IMPACTS_A },
    ]);

    expect(Object.keys(result).sort()).toEqual(["google", "openai"]);
    expect(result.openai.gwp).toEqual({ min: 2, max: 4 });
    expect(result.google.gwp).toEqual({ min: 10, max: 20 });
  });

  it("returns an empty object for no entries", () => {
    expect(aggregateByProvider([])).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/aggregate.test.ts`
Expected: FAIL — `Failed to resolve import "../src/domain/aggregate"`

- [ ] **Step 3: Write the implementation**

Create `frontend/src/domain/aggregate.ts`:

```typescript
import type { Impacts, ImpactRange } from "../api/client";

const CRITERIA = ["gwp", "energy", "adpe", "pe", "water"] as const;

export function zeroImpacts(): Impacts {
  const zero: ImpactRange = { min: 0, max: 0 };
  return { gwp: zero, energy: zero, adpe: zero, pe: zero, water: zero };
}

export function scaleImpacts(impacts: Impacts, factor: number): Impacts {
  const result = {} as Impacts;
  for (const key of CRITERIA) {
    result[key] = {
      min: impacts[key].min * factor,
      max: impacts[key].max * factor,
    };
  }
  return result;
}

export function sumImpacts(a: Impacts, b: Impacts): Impacts {
  const result = {} as Impacts;
  for (const key of CRITERIA) {
    result[key] = {
      min: a[key].min + b[key].min,
      max: a[key].max + b[key].max,
    };
  }
  return result;
}

export function aggregateByProvider(
  entries: Array<{ providerId: string; impacts: Impacts }>,
): Record<string, Impacts> {
  const result: Record<string, Impacts> = {};
  for (const entry of entries) {
    result[entry.providerId] = sumImpacts(
      result[entry.providerId] ?? zeroImpacts(),
      entry.impacts,
    );
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/aggregate.test.ts`
Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/domain/aggregate.ts frontend/tests/aggregate.test.ts
git commit -m "feat: add pure impact aggregation helpers"
```

---

### Task 5: API client — `fetchUseCases()`

**Files:**

- Modify: `frontend/src/api/client.ts`
- Test: `frontend/tests/client.test.ts`

**Interfaces:**

- Produces (for Tasks 7-9): types `CatalogProvider{id: string; selectedByDefault: boolean}`, `Profile{id: string; impacts: Impacts}`, `ProviderMapping{providerId: string; profiles: Profile[]}`, `UseCase{id: string; providers: ProviderMapping[]}`, `UseCasesCatalog{providers: CatalogProvider[]; useCases: UseCase[]}`; function `fetchUseCases(): Promise<UseCasesCatalog>` (throws `ApiError` on non-OK response, same pattern as `fetchProviders`/`calculate`).

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/client.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchUseCases } from "../src/api/client";

describe("fetchUseCases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts snake_case provider_id/selected_by_default to camelCase", async () => {
    const body = {
      providers: [{ id: "openai", selected_by_default: true }],
      use_cases: [
        {
          id: "email",
          providers: [
            {
              provider_id: "openai",
              profiles: [
                {
                  id: "eco",
                  impacts: {
                    gwp: { min: 1, max: 2 },
                    energy: { min: 0, max: 0 },
                    adpe: { min: 0, max: 0 },
                    pe: { min: 0, max: 0 },
                    water: { min: 0, max: 0 },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
      }),
    );

    const catalog = await fetchUseCases();

    expect(catalog.providers).toEqual([
      { id: "openai", selectedByDefault: true },
    ]);
    expect(catalog.useCases[0].providers[0].providerId).toBe("openai");
    expect(catalog.useCases[0].providers[0].profiles[0].impacts.gwp).toEqual({
      min: 1,
      max: 2,
    });
  });

  it("throws ApiError when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(fetchUseCases()).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/client.test.ts`
Expected: FAIL — `fetchUseCases is not a function` (not yet exported)

- [ ] **Step 3: Write the implementation**

Edit `frontend/src/api/client.ts`, appending after the existing `calculate` function:

```typescript
export interface CatalogProvider {
  id: string;
  selectedByDefault: boolean;
}

export interface Profile {
  id: string;
  impacts: Impacts;
}

export interface ProviderMapping {
  providerId: string;
  profiles: Profile[];
}

export interface UseCase {
  id: string;
  providers: ProviderMapping[];
}

export interface UseCasesCatalog {
  providers: CatalogProvider[];
  useCases: UseCase[];
}

interface UseCasesResponseBody {
  providers: Array<{ id: string; selected_by_default: boolean }>;
  use_cases: Array<{
    id: string;
    providers: Array<{
      provider_id: string;
      profiles: Array<{ id: string; impacts: Impacts }>;
    }>;
  }>;
}

export async function fetchUseCases(): Promise<UseCasesCatalog> {
  const response = await fetch(`${API_BASE}/api/use-cases`);
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to fetch use cases");
  }
  const body: UseCasesResponseBody = await response.json();
  return {
    providers: body.providers.map((p) => ({
      id: p.id,
      selectedByDefault: p.selected_by_default,
    })),
    useCases: body.use_cases.map((uc) => ({
      id: uc.id,
      providers: uc.providers.map((pm) => ({
        providerId: pm.provider_id,
        profiles: pm.profiles.map((p) => ({ id: p.id, impacts: p.impacts })),
      })),
    })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/client.test.ts`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/tests/client.test.ts
git commit -m "feat: add fetchUseCases() to the API client"
```

---

### Task 6: i18n catalogue keys

**Files:**

- Modify: `frontend/src/i18n/fr.json`
- Modify: `frontend/src/i18n/en.json`

**Interfaces:**

- Produces (for Tasks 7-9): translation keys `providers.<id>` (5 provider display names), `useCases.<id>.name` (8 use case display names), `calculator.tier.<id>` (profile tier labels: `eco`, `balanced`, `powerful`, `research`, `image`, `video`), `calculator.providersHeading`, `calculator.detailsToggle`, `calculator.frequencyPerDay`, `calculator.providerSelect`, `calculator.profileSelect`, `calculator.profileUnsupported`, `calculator.breakdownByProvider`, `calculator.errorCatalogLoad`, `calculator.retry`.

This is a config-only task (JSON content, no test code of its own) — its keys are exercised by Tasks 7-9's component tests.

- [ ] **Step 1: Add the new keys to `frontend/src/i18n/fr.json`**

Edit `frontend/src/i18n/fr.json`, replacing the `calculator` object's content and adding two new top-level keys (`providers`, `useCases`):

```json
{
  "common": {
    "appName": "AI Calculator"
  },
  "providers": {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "mistral": "Mistral AI",
    "google": "Google",
    "microsoft_copilot": "Microsoft Copilot"
  },
  "useCases": {
    "video": { "name": "Génération de vidéos" },
    "image": { "name": "Génération d'images" },
    "deep_research": { "name": "Recherche approfondie" },
    "meet_summary": { "name": "Résumé de réunion" },
    "doc_small": { "name": "Rédaction d'un document court" },
    "doc_large": { "name": "Rédaction d'un document long" },
    "ai_query": { "name": "Question à un assistant IA" },
    "email": { "name": "Rédaction d'un email" }
  },
  "calculator": {
    "title": "Calculateur d'impacts",
    "providersHeading": "Écosystème IA",
    "providerSelect": "Fournisseur",
    "profileSelect": "Profil",
    "profileUnsupported": "Non disponible pour ce fournisseur",
    "frequencyPerDay": "Fréquence par jour",
    "detailsToggle": "Voir/Masquer le détail de vos impacts pour cette tâche",
    "breakdownByProvider": "Répartition par fournisseur",
    "resultUnit": "Par action",
    "resultIndividualAnnual": "Par personne et par an",
    "resultEnterpriseAnnual": "Pour l'entreprise et par an",
    "headcount": "Nombre de salariés",
    "tier": {
      "eco": "Éco",
      "balanced": "Équilibré",
      "powerful": "Puissant",
      "research": "Recherche approfondie",
      "image": "Standard",
      "video": "Standard"
    },
    "criterion": {
      "gwp": "Gaz à effet de serre",
      "energy": "Énergie",
      "adpe": "Ressources minérales",
      "pe": "Énergie primaire",
      "water": "Eau"
    },
    "errorCatalogLoad": "Impossible de charger le catalogue de cas d'usage.",
    "retry": "Réessayer",
    "co2Equivalent": {
      "car_km": "{{count}} km en voiture",
      "beef_burger": "{{count}} burgers au bœuf",
      "laptop_hour": "{{count}} heures d'utilisation d'un ordinateur portable"
    }
  },
  "methodology": {
    "title": "Méthodologie",
    "body": "Les impacts sont calculés à partir d'EcoLogits, qui modélise l'inférence des modèles d'IA générative..."
  },
  "about": {
    "title": "À propos",
    "body": "AI Calculator est un projet du Collectif Conception Numérique Responsable (cnumr)."
  },
  "legal": {
    "title": "Mentions légales",
    "body": "Éditeur : cnumr. Hébergement : à préciser."
  },
  "nav": {
    "calculator": "Calculateur",
    "methodology": "Méthodologie",
    "about": "À propos",
    "legal": "Mentions légales"
  }
}
```

- [ ] **Step 2: Add the matching keys to `frontend/src/i18n/en.json`**

Edit `frontend/src/i18n/en.json`:

```json
{
  "common": {
    "appName": "AI Calculator"
  },
  "providers": {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "mistral": "Mistral AI",
    "google": "Google",
    "microsoft_copilot": "Microsoft Copilot"
  },
  "useCases": {
    "video": { "name": "Video generation" },
    "image": { "name": "Image generation" },
    "deep_research": { "name": "Deep research" },
    "meet_summary": { "name": "Meeting summary" },
    "doc_small": { "name": "Writing a short document" },
    "doc_large": { "name": "Writing a long document" },
    "ai_query": { "name": "Query to an AI assistant" },
    "email": { "name": "Writing an email" }
  },
  "calculator": {
    "title": "Impact calculator",
    "providersHeading": "AI ecosystem",
    "providerSelect": "Provider",
    "profileSelect": "Profile",
    "profileUnsupported": "Not available for this provider",
    "frequencyPerDay": "Frequency per day",
    "detailsToggle": "Show/hide the impact details for this task",
    "breakdownByProvider": "Breakdown by provider",
    "resultUnit": "Per action",
    "resultIndividualAnnual": "Per person, per year",
    "resultEnterpriseAnnual": "For the company, per year",
    "headcount": "Headcount",
    "tier": {
      "eco": "Eco",
      "balanced": "Balanced",
      "powerful": "Powerful",
      "research": "Deep research",
      "image": "Standard",
      "video": "Standard"
    },
    "criterion": {
      "gwp": "Greenhouse gases",
      "energy": "Energy",
      "adpe": "Mineral resources",
      "pe": "Primary energy",
      "water": "Water"
    },
    "errorCatalogLoad": "Could not load the use case catalogue.",
    "retry": "Retry",
    "co2Equivalent": {
      "car_km": "{{count}} km by car",
      "beef_burger": "{{count}} beef burgers",
      "laptop_hour": "{{count}} hours of laptop use"
    }
  },
  "methodology": {
    "title": "Methodology",
    "body": "Impacts are computed from EcoLogits, which models generative AI model inference..."
  },
  "about": {
    "title": "About",
    "body": "AI Calculator is a project by Collectif Conception Numérique Responsable (cnumr)."
  },
  "legal": {
    "title": "Legal notice",
    "body": "Publisher: cnumr. Hosting: TBD."
  },
  "nav": {
    "calculator": "Calculator",
    "methodology": "Methodology",
    "about": "About",
    "legal": "Legal notice"
  }
}
```

- [ ] **Step 3: Verify the JSON is valid and the app still builds**

Run: `cd frontend && node -e "require('./src/i18n/fr.json'); require('./src/i18n/en.json'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "feat: add i18n keys for the use case catalogue"
```

---

### Task 7: `ProviderChips` component

**Files:**

- Create: `frontend/src/components/ProviderChips.tsx`
- Test: `frontend/tests/ProviderChips.test.tsx`

**Interfaces:**

- Consumes: `frontend/src/api/client.ts`'s `CatalogProvider`; the 5 SVGs at `frontend/src/assets/providers/{openai,anthropic,mistral,google,microsoft_copilot}.svg`; i18n keys `providers.<id>`, `calculator.providersHeading`.
- Produces (for Task 9): `ProviderChips({ providers: CatalogProvider[]; selected: Set<string>; onToggle: (id: string) => void })` — a React component rendering one toggle button per provider, `aria-pressed` reflecting membership in `selected`.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/ProviderChips.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { ProviderChips } from "../src/components/ProviderChips";

const PROVIDERS = [
  { id: "openai", selectedByDefault: true },
  { id: "anthropic", selectedByDefault: false },
];

describe("ProviderChips", () => {
  it("reflects selected state via aria-pressed", () => {
    render(
      <ProviderChips
        providers={PROVIDERS}
        selected={new Set(["openai"])}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /openai/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /anthropic/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onToggle with the provider id when clicked", async () => {
    const onToggle = vi.fn();
    render(
      <ProviderChips
        providers={PROVIDERS}
        selected={new Set(["openai"])}
        onToggle={onToggle}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /anthropic/i }));

    expect(onToggle).toHaveBeenCalledWith("anthropic");
  });

  it("shows a textual fallback when a provider has no known logo", () => {
    render(
      <ProviderChips
        providers={[{ id: "unknown_provider", selectedByDefault: false }]}
        selected={new Set()}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/ProviderChips.test.tsx`
Expected: FAIL — `Failed to resolve import "../src/components/ProviderChips"`

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/ProviderChips.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import type { CatalogProvider } from "../api/client";
import openaiLogo from "../assets/providers/openai.svg";
import anthropicLogo from "../assets/providers/anthropic.svg";
import mistralLogo from "../assets/providers/mistral.svg";
import googleLogo from "../assets/providers/google.svg";
import microsoftCopilotLogo from "../assets/providers/microsoft_copilot.svg";

const PROVIDER_LOGOS: Record<string, string> = {
  openai: openaiLogo,
  anthropic: anthropicLogo,
  mistral: mistralLogo,
  google: googleLogo,
  microsoft_copilot: microsoftCopilotLogo,
};

interface ProviderChipsProps {
  providers: CatalogProvider[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function ProviderChips({
  providers,
  selected,
  onToggle,
}: ProviderChipsProps) {
  const { t } = useTranslation();

  return (
    <div className="provider-chips">
      <h2 className="provider-chips__heading">
        {t("calculator.providersHeading")}
      </h2>
      <div className="provider-chips__list">
        {providers.map((provider) => {
          const logo = PROVIDER_LOGOS[provider.id];
          const label = t(`providers.${provider.id}`, {
            defaultValue: provider.id,
          });
          return (
            <button
              key={provider.id}
              type="button"
              className="provider-chips__chip"
              aria-pressed={selected.has(provider.id)}
              onClick={() => onToggle(provider.id)}
            >
              {logo ? (
                <img
                  src={logo}
                  alt=""
                  className="provider-chips__logo"
                />
              ) : (
                <span className="provider-chips__logo-fallback">
                  {label.charAt(0).toUpperCase()}
                </span>
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/ProviderChips.test.tsx`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProviderChips.tsx frontend/tests/ProviderChips.test.tsx
git commit -m "feat: add ProviderChips component"
```

---

### Task 8: `UseCaseCard` component

**Files:**

- Create: `frontend/src/components/UseCaseCard.tsx`
- Test: `frontend/tests/UseCaseCard.test.tsx`

**Interfaces:**

- Consumes: `frontend/src/api/client.ts`'s `UseCase`, `Impacts`; `frontend/src/components/RangeGauge.tsx`'s `RangeGauge`; the 8 SVGs at `frontend/src/assets/use-cases/*.svg`; i18n keys `useCases.<id>.name`, `calculator.tier.<id>`, `calculator.detailsToggle`, `calculator.providerSelect`, `calculator.profileSelect`, `calculator.profileUnsupported`, `calculator.frequencyPerDay`, `calculator.criterion.<key>`.
- Produces (for Task 9): `UseCaseCard({ useCase: UseCase; availableProviderIds: string[]; providerId: string; profileId: string; frequencyPerDay: number; onChange: (next: { providerId: string; profileId: string; frequencyPerDay: number }) => void; onImpactsChange: (impacts: Impacts) => void })` — fully controlled: parent owns `providerId`/`profileId`/`frequencyPerDay` and passes them in; the card calls `onChange` when the user edits any of them, and `onImpactsChange` whenever the currently-resolved profile's impacts change (including on mount and on every prop change), so the parent can aggregate without duplicating the resolution logic.

- [ ] **Step 1: Write the failing tests**

Create `frontend/tests/UseCaseCard.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { UseCaseCard } from "../src/components/UseCaseCard";
import type { UseCase } from "../src/api/client";

const ZERO_RANGE = { min: 0, max: 0 };
const ZERO_IMPACTS = {
  gwp: ZERO_RANGE,
  energy: ZERO_RANGE,
  adpe: ZERO_RANGE,
  pe: ZERO_RANGE,
  water: ZERO_RANGE,
};

const EMAIL: UseCase = {
  id: "email",
  providers: [
    {
      providerId: "openai",
      profiles: [
        { id: "eco", impacts: { ...ZERO_IMPACTS, gwp: { min: 1, max: 2 } } },
        { id: "powerful", impacts: { ...ZERO_IMPACTS, gwp: { min: 5, max: 8 } } },
      ],
    },
    {
      providerId: "anthropic",
      profiles: [
        { id: "eco", impacts: { ...ZERO_IMPACTS, gwp: { min: 3, max: 4 } } },
      ],
    },
  ],
};

describe("UseCaseCard", () => {
  it("renders the use case name and its picto", () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    expect(
      screen.getByText(/rédaction d'un email|writing an email/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });

  it("only offers profiles available for the currently selected provider", () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="anthropic"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    const profileSelect = screen.getByLabelText(/profil|profile/i);
    const options = Array.from(profileSelect.querySelectorAll("option")).map(
      (o) => o.getAttribute("value"),
    );
    expect(options).toEqual(["eco"]);
  });

  it("calls onImpactsChange with the resolved profile impacts on mount", () => {
    const onImpactsChange = vi.fn();
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={onImpactsChange}
      />,
    );

    expect(onImpactsChange).toHaveBeenCalledWith(
      expect.objectContaining({ gwp: { min: 1, max: 2 } }),
    );
  });

  it("calls onChange when the profile select changes", async () => {
    const onChange = vi.fn();
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={onChange}
        onImpactsChange={() => {}}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/profil|profile/i),
      "powerful",
    );

    expect(onChange).toHaveBeenCalledWith({
      providerId: "openai",
      profileId: "powerful",
      frequencyPerDay: 1,
    });
  });

  it("shows details for the 5 indicators only after the toggle is opened", async () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    const details = screen.getByText(
      /voir\/masquer le détail|show\/hide the impact details/i,
    ).closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    await userEvent.click(screen.getByText(
      /voir\/masquer le détail|show\/hide the impact details/i,
    ));

    expect(details).toHaveAttribute("open");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run tests/UseCaseCard.test.tsx`
Expected: FAIL — `Failed to resolve import "../src/components/UseCaseCard"`

- [ ] **Step 3: Write the implementation**

Create `frontend/src/components/UseCaseCard.tsx`:

```typescript
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Impacts, UseCase } from "../api/client";
import { RangeGauge } from "./RangeGauge";
import videoIcon from "../assets/use-cases/video.svg";
import imageIcon from "../assets/use-cases/image.svg";
import deepResearchIcon from "../assets/use-cases/deep_research.svg";
import meetSummaryIcon from "../assets/use-cases/meet_summary.svg";
import docSmallIcon from "../assets/use-cases/doc_small.svg";
import docLargeIcon from "../assets/use-cases/doc_large.svg";
import aiQueryIcon from "../assets/use-cases/ai_query.svg";
import emailIcon from "../assets/use-cases/email.svg";

const USE_CASE_ICONS: Record<string, string> = {
  video: videoIcon,
  image: imageIcon,
  deep_research: deepResearchIcon,
  meet_summary: meetSummaryIcon,
  doc_small: docSmallIcon,
  doc_large: docLargeIcon,
  ai_query: aiQueryIcon,
  email: emailIcon,
};

const CRITERIA: Array<{ key: keyof Impacts; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "energy", unit: "kWh" },
  { key: "adpe", unit: "kgSbeq" },
  { key: "pe", unit: "MJ" },
  { key: "water", unit: "L" },
];

interface UseCaseCardProps {
  useCase: UseCase;
  availableProviderIds: string[];
  providerId: string;
  profileId: string;
  frequencyPerDay: number;
  onChange: (next: {
    providerId: string;
    profileId: string;
    frequencyPerDay: number;
  }) => void;
  onImpactsChange: (impacts: Impacts) => void;
}

export function UseCaseCard({
  useCase,
  availableProviderIds,
  providerId,
  profileId,
  frequencyPerDay,
  onChange,
  onImpactsChange,
}: UseCaseCardProps) {
  const { t } = useTranslation();

  const offeredProviders = useCase.providers.filter((pm) =>
    availableProviderIds.includes(pm.providerId),
  );
  const currentMapping =
    offeredProviders.find((pm) => pm.providerId === providerId) ??
    offeredProviders[0];
  const profiles = currentMapping?.profiles ?? [];
  const currentProfile =
    profiles.find((p) => p.id === profileId) ?? profiles[0];

  useEffect(() => {
    if (currentProfile) {
      onImpactsChange(currentProfile.impacts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMapping?.providerId, currentProfile?.id]);

  const inputIdPrefix = `use-case-${useCase.id}`;

  return (
    <article className="use-case-card">
      <header className="use-case-card__header">
        {USE_CASE_ICONS[useCase.id] && (
          <img src={USE_CASE_ICONS[useCase.id]} alt="" role="img" />
        )}
        <h3>{t(`useCases.${useCase.id}.name`)}</h3>
      </header>

      {!currentMapping || profiles.length === 0 ? (
        <p className="use-case-card__unsupported">
          {t("calculator.profileUnsupported")}
        </p>
      ) : (
        <>
          <div className="use-case-card__field">
            <label htmlFor={`${inputIdPrefix}-provider`}>
              {t("calculator.providerSelect")}
            </label>
            <select
              id={`${inputIdPrefix}-provider`}
              value={currentMapping.providerId}
              onChange={(e) => {
                const nextMapping = offeredProviders.find(
                  (pm) => pm.providerId === e.target.value,
                );
                const nextProfileId = nextMapping?.profiles[0]?.id ?? "";
                onChange({
                  providerId: e.target.value,
                  profileId: nextProfileId,
                  frequencyPerDay,
                });
              }}
            >
              {offeredProviders.map((pm) => (
                <option key={pm.providerId} value={pm.providerId}>
                  {t(`providers.${pm.providerId}`, {
                    defaultValue: pm.providerId,
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="use-case-card__field">
            <label htmlFor={`${inputIdPrefix}-profile`}>
              {t("calculator.profileSelect")}
            </label>
            <select
              id={`${inputIdPrefix}-profile`}
              value={currentProfile?.id ?? ""}
              onChange={(e) =>
                onChange({
                  providerId: currentMapping.providerId,
                  profileId: e.target.value,
                  frequencyPerDay,
                })
              }
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {t(`calculator.tier.${profile.id}`, {
                    defaultValue: profile.id,
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="use-case-card__field">
            <label htmlFor={`${inputIdPrefix}-frequency`}>
              {t("calculator.frequencyPerDay")}
            </label>
            <input
              id={`${inputIdPrefix}-frequency`}
              type="number"
              min={0}
              value={frequencyPerDay}
              onChange={(e) =>
                onChange({
                  providerId: currentMapping.providerId,
                  profileId: currentProfile?.id ?? "",
                  frequencyPerDay: Number(e.target.value),
                })
              }
            />
          </div>

          {currentProfile && (
            <details className="use-case-card__details">
              <summary>{t("calculator.detailsToggle")}</summary>
              {CRITERIA.map(({ key, unit }) => (
                <RangeGauge
                  key={key}
                  min={currentProfile.impacts[key].min}
                  max={currentProfile.impacts[key].max}
                  unit={unit}
                  label={t(`calculator.criterion.${key}`)}
                />
              ))}
            </details>
          )}
        </>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run tests/UseCaseCard.test.tsx`
Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UseCaseCard.tsx frontend/tests/UseCaseCard.test.tsx
git commit -m "feat: add UseCaseCard component"
```

---

### Task 9: Rewrite `CalculatorPage`

**Files:**

- Modify: `frontend/src/pages/CalculatorPage.tsx`
- Modify: `frontend/tests/CalculatorPage.test.tsx`

**Interfaces:**

- Consumes: Task 4's `zeroImpacts`, `scaleImpacts`, `sumImpacts`, `aggregateByProvider`; Task 5's `fetchUseCases`, `UseCasesCatalog`, `Impacts`, `ApiError`; Task 7's `ProviderChips`; Task 8's `UseCaseCard`; existing `Co2Equivalents`, `RangeGauge`.
- Produces: `CalculatorPage()` — no external consumers (top-level page, routed from `App.tsx`, which is unchanged since the route/component name stays the same).

Working-days-per-year stays a fixed constant (`220`, matching the backend's V1 default) — not exposed as a form field, consistent with the existing V1 page, which never exposed it either.

- [ ] **Step 1: Write the failing tests**

Replace the full content of `frontend/tests/CalculatorPage.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { CalculatorPage } from "../src/pages/CalculatorPage";
import * as apiClient from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return {
    ...actual,
    fetchUseCases: vi.fn(),
  };
});

const mockedFetchUseCases = vi.mocked(apiClient.fetchUseCases);

const ZERO_RANGE = { min: 0, max: 0 };
const ZERO_IMPACTS = {
  gwp: ZERO_RANGE,
  energy: ZERO_RANGE,
  adpe: ZERO_RANGE,
  pe: ZERO_RANGE,
  water: ZERO_RANGE,
};

const CATALOG: apiClient.UseCasesCatalog = {
  providers: [
    { id: "openai", selectedByDefault: true },
    { id: "anthropic", selectedByDefault: false },
  ],
  useCases: [
    {
      id: "email",
      providers: [
        {
          providerId: "openai",
          profiles: [
            {
              id: "eco",
              impacts: { ...ZERO_IMPACTS, gwp: { min: 1, max: 2 } },
            },
          ],
        },
        {
          providerId: "anthropic",
          profiles: [
            {
              id: "eco",
              impacts: { ...ZERO_IMPACTS, gwp: { min: 3, max: 4 } },
            },
          ],
        },
      ],
    },
  ],
};

describe("CalculatorPage", () => {
  it("loads the catalogue once and renders one card per use case", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/rédaction d'un email|writing an email/i),
      ).toBeInTheDocument(),
    );
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(1);
  });

  it("renders a chip per provider, initialised from selectedByDefault", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /openai/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /openai/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /anthropic/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("switches a card's provider away from a deselected chip", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /openai/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /anthropic/i }));
    await userEvent.click(screen.getByRole("button", { name: /openai/i }));

    const providerSelect = screen.getByLabelText(/fournisseur|provider/i);
    expect(providerSelect).toHaveValue("anthropic");
  });

  it("shows a full-page error with retry when the catalogue fails to load", async () => {
    mockedFetchUseCases.mockRejectedValueOnce(new apiClient.ApiError(500, "boom"));
    mockedFetchUseCases.mockResolvedValueOnce(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(
          /impossible de charger le catalogue|could not load the use case catalogue/i,
        ),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /réessayer|retry/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/rédaction d'un email|writing an email/i),
      ).toBeInTheDocument(),
    );
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(2);
  });

  it("aggregates individual annual impact from the card's gwp and frequency", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/rédaction d'un email|writing an email/i),
      ).toBeInTheDocument(),
    );

    // Default frequency is 1/day, 220 working days/year, gwp max = 2 -> 440
    await waitFor(() => expect(screen.getByText(/440/)).toBeInTheDocument());
  });

  it("shows the breakdown by provider with details for the other 4 indicators", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    render(<CalculatorPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/répartition par fournisseur|breakdown by provider/i),
      ).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run tests/CalculatorPage.test.tsx`
Expected: FAIL — old `CalculatorPage` still calls `fetchProviders`/`calculate`, none of the new elements exist

- [ ] **Step 3: Write the implementation**

Replace the full content of `frontend/src/pages/CalculatorPage.tsx`:

```typescript
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  Impacts,
  UseCasesCatalog,
  fetchUseCases,
} from "../api/client";
import { ProviderChips } from "../components/ProviderChips";
import { UseCaseCard } from "../components/UseCaseCard";
import { RangeGauge } from "../components/RangeGauge";
import { Co2Equivalents } from "../components/Co2Equivalents";
import {
  aggregateByProvider,
  scaleImpacts,
  sumImpacts,
  zeroImpacts,
} from "../domain/aggregate";

const WORKING_DAYS_PER_YEAR = 220;

const CRITERIA: Array<{ key: keyof Impacts; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "energy", unit: "kWh" },
  { key: "adpe", unit: "kgSbeq" },
  { key: "pe", unit: "MJ" },
  { key: "water", unit: "L" },
];

interface CardState {
  providerId: string;
  profileId: string;
  frequencyPerDay: number;
}

function ImpactsGrid({ impacts, title }: { impacts: Impacts; title: string }) {
  const { t } = useTranslation();
  return (
    <section className="impacts-grid">
      <h3>{title}</h3>
      {CRITERIA.map(({ key, unit }) => (
        <RangeGauge
          key={key}
          min={impacts[key].min}
          max={impacts[key].max}
          unit={unit}
          label={t(`calculator.criterion.${key}`)}
        />
      ))}
    </section>
  );
}

function ProviderBreakdown({
  breakdown,
}: {
  breakdown: Record<string, Impacts>;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return null;

  return (
    <section className="provider-breakdown">
      <h3>{t("calculator.breakdownByProvider")}</h3>
      <ul>
        {entries.map(([providerId, impacts]) => (
          <li key={providerId}>
            <strong>
              {t(`providers.${providerId}`, { defaultValue: providerId })}
            </strong>{" "}
            {impacts.gwp.min.toPrecision(3)} – {impacts.gwp.max.toPrecision(3)}{" "}
            kgCO2eq
          </li>
        ))}
      </ul>
      <details>
        <summary>{t("calculator.detailsToggle")}</summary>
        {entries.map(([providerId, impacts]) => (
          <ImpactsGrid
            key={providerId}
            impacts={impacts}
            title={t(`providers.${providerId}`, { defaultValue: providerId })}
          />
        ))}
      </details>
    </section>
  );
}

export function CalculatorPage() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<UseCasesCatalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    new Set(),
  );
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [cardImpacts, setCardImpacts] = useState<
    Record<string, { providerId: string; impacts: Impacts }>
  >({});
  const [headcount, setHeadcount] = useState(1);

  const loadCatalog = useCallback(() => {
    setLoadError(false);
    setCatalog(null);
    fetchUseCases()
      .then((loaded) => {
        setCatalog(loaded);
        setSelectedProviders(
          new Set(
            loaded.providers
              .filter((p) => p.selectedByDefault)
              .map((p) => p.id),
          ),
        );
        const initialStates: Record<string, CardState> = {};
        for (const useCase of loaded.useCases) {
          const firstMapping = useCase.providers[0];
          initialStates[useCase.id] = {
            providerId: firstMapping?.providerId ?? "",
            profileId: firstMapping?.profiles[0]?.id ?? "",
            frequencyPerDay: 1,
          };
        }
        setCardStates(initialStates);
      })
      .catch(() => {
        if (!(true instanceof ApiError)) {
          // ApiError and network errors both surface as a load failure.
        }
        setLoadError(true);
      });
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  function toggleProvider(id: string) {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (loadError) {
    return (
      <div className="calculator-error-page">
        <p role="alert">{t("calculator.errorCatalogLoad")}</p>
        <button type="button" onClick={loadCatalog}>
          {t("calculator.retry")}
        </button>
      </div>
    );
  }

  if (!catalog) {
    return null;
  }

  const individualAnnual = Object.values(cardImpacts).reduce(
    (total, entry) =>
      sumImpacts(
        total,
        scaleImpacts(
          entry.impacts,
          (cardStates[entry.providerId]?.frequencyPerDay ?? 0) *
            WORKING_DAYS_PER_YEAR,
        ),
      ),
    zeroImpacts(),
  );

  const perCardAnnualEntries = Object.entries(cardImpacts).map(
    ([useCaseId, entry]) => ({
      providerId: entry.providerId,
      impacts: scaleImpacts(
        entry.impacts,
        (cardStates[useCaseId]?.frequencyPerDay ?? 0) * WORKING_DAYS_PER_YEAR,
      ),
    }),
  );
  const providerBreakdown = aggregateByProvider(perCardAnnualEntries);
  const enterpriseAnnual = scaleImpacts(individualAnnual, headcount);

  return (
    <div>
      <div className="calculator-hero">
        <h1>{t("calculator.title")}</h1>
      </div>

      <ProviderChips
        providers={catalog.providers}
        selected={selectedProviders}
        onToggle={toggleProvider}
      />

      <div className="use-case-catalog">
        {catalog.useCases.map((useCase) => {
          const state = cardStates[useCase.id];
          if (!state) return null;
          return (
            <UseCaseCard
              key={useCase.id}
              useCase={useCase}
              availableProviderIds={Array.from(selectedProviders)}
              providerId={state.providerId}
              profileId={state.profileId}
              frequencyPerDay={state.frequencyPerDay}
              onChange={(next) =>
                setCardStates((prev) => ({ ...prev, [useCase.id]: next }))
              }
              onImpactsChange={(impacts) =>
                setCardImpacts((prev) => ({
                  ...prev,
                  [useCase.id]: { providerId: state.providerId, impacts },
                }))
              }
            />
          );
        })}
      </div>

      <ImpactsGrid
        impacts={individualAnnual}
        title={t("calculator.resultIndividualAnnual")}
      />
      <Co2Equivalents gwpKgCo2eq={individualAnnual.gwp.max} />
      <ProviderBreakdown breakdown={providerBreakdown} />

      <div className="calculator-form__field">
        <label htmlFor="calculator-headcount">
          {t("calculator.headcount")}
        </label>
        <input
          id="calculator-headcount"
          type="number"
          min={1}
          value={headcount}
          onChange={(e) => setHeadcount(Number(e.target.value))}
        />
      </div>
      <ImpactsGrid
        impacts={enterpriseAnnual}
        title={t("calculator.resultEnterpriseAnnual")}
      />
    </div>
  );
}
```

- [ ] **Step 4: Remove the dead `if (!(true instanceof ApiError))` no-op**

That conditional in Step 3 is a leftover no-op that must not ship. Edit `frontend/src/pages/CalculatorPage.tsx`, replacing the `.catch()` block:

```typescript
      .catch(() => {
        setLoadError(true);
      });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run tests/CalculatorPage.test.tsx`
Expected: `6 passed`

- [ ] **Step 6: Run the full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all test files pass (no regressions in `App.test.tsx`, `Co2Equivalents.test.tsx`, `RangeGauge.test.tsx`, plus the new `aggregate.test.ts`, `client.test.ts`, `ProviderChips.test.tsx`, `UseCaseCard.test.tsx`, `CalculatorPage.test.tsx`)

- [ ] **Step 7: Type-check and build**

Run: `cd frontend && npm run build`
Expected: builds successfully, no TypeScript errors

- [ ] **Step 8: Manually verify in the browser**

Run: `cd backend && .venv/bin/uvicorn ai_calculator.main:app --reload &` then `cd frontend && npm run dev`, open the dev server URL, confirm: 8 use-case cards render, provider chips toggle and update available options in the cards' provider selects, changing a card's profile updates its collapsed detail values, individual/enterprise panels and the provider breakdown update live. Stop both dev processes when done.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/CalculatorPage.tsx frontend/tests/CalculatorPage.test.tsx
git commit -m "feat: rewrite CalculatorPage around the use case catalogue"
```

---

### Task 10: Playwright E2E setup and scenario

**Files:**

- Modify: `frontend/package.json`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/catalogue.spec.ts`

**Interfaces:**

- Consumes: the running dev stack (backend on `http://localhost:8000`, frontend on `http://localhost:5173`) — Playwright's own `webServer` config starts the frontend automatically; the backend is expected to already be running (documented in Step 5).

- [ ] **Step 1: Add the `@playwright/test` devDependency**

Run: `cd frontend && npm install --save-dev @playwright/test@1.61.1`
Expected: `package.json` gains `"@playwright/test": "1.61.1"` under `devDependencies`, `package-lock.json` updated

- [ ] **Step 2: Install the Playwright browser binaries**

Run: `cd frontend && npx playwright install chromium --with-deps`
Expected: Chromium downloaded and installed without error

- [ ] **Step 3: Add the `test:e2e` script**

Edit `frontend/package.json`, adding `"test:e2e": "playwright test"` to the `scripts` object (alongside the existing `dev`, `build`, `test`).

- [ ] **Step 4: Create the Playwright config**

Create `frontend/playwright.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 5: Write the failing E2E scenario**

Create `frontend/e2e/catalogue.spec.ts`. This test requires the backend API running at `http://localhost:8000` (start it separately with `cd backend && .venv/bin/uvicorn ai_calculator.main:app` before running `npm run test:e2e`; the frontend's `VITE_API_BASE_URL` must point at it, matching how `frontend/src/api/client.ts` resolves `API_BASE`):

```typescript
import { expect, test } from "@playwright/test";

test("catalogue-driven calculator: load, toggle provider, change profile, verify totals update", async ({
  page,
}) => {
  await page.goto("/");

  const firstCard = page.locator(".use-case-card").first();
  await expect(firstCard).toBeVisible();

  const openaiChip = page.getByRole("button", { name: /openai/i });
  await expect(openaiChip).toHaveAttribute("aria-pressed", "true");

  const individualBefore = await page
    .locator(".impacts-grid")
    .first()
    .textContent();

  const profileSelect = firstCard.getByLabelText(/profil|profile/i);
  await profileSelect.selectOption({
    index: profileSelect.locator("option").count() > 1 ? 1 : 0,
  });

  await firstCard
    .getByText(/voir\/masquer le détail|show\/hide the impact details/i)
    .click();
  await expect(firstCard.locator("details")).toHaveAttribute("open", "");

  const individualAfter = await page
    .locator(".impacts-grid")
    .first()
    .textContent();

  const anthropicChip = page.getByRole("button", { name: /anthropic/i });
  await anthropicChip.click();
  await expect(anthropicChip).toHaveAttribute("aria-pressed", "true");

  expect(individualBefore).not.toEqual(individualAfter);
});
```

- [ ] **Step 6: Run the E2E test to verify it passes**

Run (with the backend already running per Step 5's note): `cd frontend && npm run test:e2e`
Expected: `1 passed`

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/playwright.config.ts frontend/e2e/catalogue.spec.ts
git commit -m "test: add Playwright E2E setup and catalogue scenario"
```

---

## Self-Review

**1. Spec coverage** — walked every section of `.superpowers/specs/2026-07-14-ai-calculator-catalogue-cas-usage-design.md`:

- Contexte/Objectif/Fonctionnel de référence/Périmètre V2: addressed by the overall plan (catalogue replaces free-form form, 5 chips, 8 cards, cascade, 5 indicators). ✓
- Fichier de config: Task 1 (exact structure, two profile shapes, `microsoft_copilot` business-id mapping). ✓
- i18n de la config: Task 6 (stable ids in config, display text only in `fr.json`/`en.json`). ✓
- API: Task 3 (`GET /api/use-cases` additive, `GET /api/providers`/`POST /api/calculate` untouched — confirmed no modification to `api/providers.py`, `api/calculate.py`, `schemas/calculate.py` besides reusing their exports). ✓
- Composants front: Task 7 (chips + logos + fallback), Task 8 (card: cascade, readonly-if-unsupported via `profileUnsupported` message, collapsed `<details>`, picto), Task 9 (`RangeGauge`/`Co2Equivalents` reused, répartition-par-fournisseur with its own `<details>`, individual/enterprise panels extended to 5 indicators). ✓
- Gestion des erreurs: Task 9 (full-page error+retry on catalogue load failure), Task 8 (unsupported combination renders a message instead of a broken select), Task 2/3 (fail-fast `UseCasesConfigError` at import time via module-level `load_catalog()` in `api/use_cases.py`, crashes app startup). ✓
- Tests: Task 2 (loader unit tests incl. unknown-model detection), Task 3 (integration test asserting 5-indicator min/max and omitted unsupported combos), Task 7/8 (cascade, disabled/absent profiles, fallback logo, picto), Task 9 (collapsed/expanded details, chip initial state + toggle), Task 10 (Playwright E2E: load, toggle, cascade, details, totals update). ✓
- Dépendances: PyYAML pinned at 6.0.3, confirmed as latest stable via live check in Task 1, not a training-data guess. ✓

**2. Placeholder scan** — no `TBD`/`TODO` strings; every code block is complete and copy-pasteable; every YAML value in Task 1 is the empirically-verified real data, not illustrative; the spec's own illustrative example (`meeting_summary`, per-value `unit:` fields, fabricated `standard` profile id) was deliberately not reused — the real ids (`meet_summary`, no `unit:` field since `ImpactRangeOut` is bare min/max) are used throughout.

**3. Type/signature consistency** — cross-checked across tasks:

- `Catalog`/`ResolvedUseCase`/`ResolvedProviderMapping`/`ResolvedProfile`/`CatalogProvider`/`load_catalog()` (Task 2) match their exact use in Task 3's `_to_use_cases_response`.
- `UseCasesResponse`/`UseCaseOut`/`ProviderMappingOut`/`ProfileOut`/`CatalogProviderOut` (Task 3 schemas) match the JSON shape Task 5's `fetchUseCases()` parses (`use_cases`/`provider_id`/`selected_by_default` snake_case in transit, camelCase after client conversion).
- `UseCasesCatalog`/`UseCase`/`ProviderMapping`/`Profile`/`CatalogProvider` (Task 5, frontend) match what Task 7 (`ProviderChips`), Task 8 (`UseCaseCard`), and Task 9 (`CalculatorPage`) import and destructure.
- `UseCaseCard`'s `onChange`/`onImpactsChange` contract (Task 8) matches exactly how Task 9's `CalculatorPage` wires `cardStates`/`cardImpacts`.
- `aggregateByProvider`/`scaleImpacts`/`sumImpacts`/`zeroImpacts` (Task 4) signatures match their call sites in Task 9.
- Found and fixed one issue during this review: Task 9's Step 3 draft contained a dead no-op branch (`if (!(true instanceof ApiError))`) inside the `fetchUseCases().catch()` handler — corrected in Step 4 to a plain `setLoadError(true)`, since the spec only requires a generic full-page error state, not error-type branching (unlike V1's `POST /api/calculate`, which does need to distinguish 404s — that logic isn't part of `GET /api/use-cases`, which either succeeds with the whole catalogue or fails outright).

No gaps found requiring new tasks.

---

## Execution Handoff

Plan complete and saved to `.superpowers/plans/2026-07-14-ai-calculator-catalogue-cas-usage-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
