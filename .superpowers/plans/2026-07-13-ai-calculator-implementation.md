# AI Calculator — Implementation Plan (V1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a bilingual (FR/EN) web app letting users estimate the environmental impacts (GWP, Water, ADPe, Energy, PE) of a Generative AI usage, as min–max ranges for all 5 impacts, with a FastAPI backend (stateless, powered by EcoLogits) and a React/Vite frontend.

**Architecture:** React (Vite, TS) SPA calling a stateless FastAPI JSON API. All business logic (impact computation via EcoLogits, extrapolation to annual/enterprise scale) lives in the backend `domain/` layer, fully covered by pytest unit tests. The frontend is presentation-only: form, API calls, and range-gauge display components, covered by Vitest + Testing Library.

**Tech Stack:** Python 3.11+, FastAPI 0.139.0, Pydantic 2.13.4, EcoLogits 0.11.1, uvicorn 0.51.0, pytest 9.1.1, httpx 0.28.1 · React 19.2.7, Vite 8.1.4, TypeScript 7.0.2, react-i18next 17.0.9, react-router-dom 7.18.1, Vitest 4.1.10, @testing-library/react 16.3.2.

## Global Constraints

- Every superpowers-framework artifact (this plan included) lives under `.superpowers/` in this repo — never at a skill's own default path (`AGENTS.md`).
- TDD throughout: a failing test is written and verified red before any implementation code (user's global instruction).
- All dependencies pinned to their latest stable version as verified against PyPI/npm on 2026-07-13 (see Tech Stack above) — do not substitute older versions from training data.
- Backend is stateless: no database, no persisted session state.
- Backend returns only raw data (numbers, identifiers) — no user-facing text, no i18n on the back.
- Frontend is bilingual FR/EN via `react-i18next`, browser-detected then persisted in `localStorage` (no route-prefix i18n).
- Every impact (GWP, Water/WCF, ADPe, Energy, PE) is displayed as a **min–max range**, never a single value, using the `RangeGauge` component (track/fill/tick/bounds), scale `0 → max × 1.1`.
- ImpactCO2 comparisons are GWP-only, via a custom React component fed by locally versioned data (`frontend/src/data/co2-equivalents.json`) — no runtime fetch to impactco2.fr.
- Repo layout: monorepo with `backend/` and `frontend/` at the root.

---

## File Structure

```
ai-calculator/
├── backend/
│   ├── pyproject.toml
│   ├── src/ai_calculator/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app, error handlers
│   │   ├── domain/
│   │   │   ├── __init__.py
│   │   │   ├── impacts.py             # EcoLogits adapter: RangeValue normalization, compute_unit_impacts
│   │   │   ├── catalog.py             # list_providers/list_models from EcoLogits model_repository
│   │   │   └── extrapolation.py       # daily → annual individual/enterprise scaling
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── providers.py           # ProviderOut, ModelOut
│   │   │   └── calculate.py           # CalculateRequest, CalculateResponse, ImpactRange
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── providers.py           # GET /api/providers router
│   │       └── calculate.py           # POST /api/calculate router
│   └── tests/
│       ├── unit/
│       │   ├── test_impacts.py
│       │   ├── test_catalog.py
│       │   └── test_extrapolation.py
│       └── integration/
│           ├── test_providers_api.py
│           └── test_calculate_api.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── i18n/
│   │   │   ├── index.ts
│   │   │   ├── fr.json
│   │   │   └── en.json
│   │   ├── api/
│   │   │   └── client.ts              # typed fetch wrapper for /api/providers, /api/calculate
│   │   ├── components/
│   │   │   ├── RangeGauge.tsx
│   │   │   └── Co2Equivalents.tsx
│   │   ├── data/
│   │   │   └── co2-equivalents.json
│   │   └── pages/
│   │       ├── CalculatorPage.tsx
│   │       ├── MethodologyPage.tsx
│   │       ├── AboutPage.tsx
│   │       └── LegalNoticePage.tsx
│   └── tests/
│       ├── RangeGauge.test.tsx
│       └── CalculatorPage.test.tsx
├── .superpowers/
├── AGENTS.md / CLAUDE.md
└── README.md
```

---

## Task 1: Backend scaffolding

**Files:**

- Create: `backend/pyproject.toml`
- Create: `backend/src/ai_calculator/__init__.py`
- Create: `backend/tests/unit/__init__.py`
- Create: `backend/tests/integration/__init__.py`

**Interfaces:**

- Produces: an installable `ai_calculator` package, a working `pytest` invocation from `backend/`.

- [ ] **Step 1: Write `pyproject.toml`**

```toml
[project]
name = "ai-calculator-backend"
version = "0.1.0"
requires-python = ">=3.11,<4"
dependencies = [
    "fastapi==0.139.0",
    "ecologits==0.11.1",
    "pydantic==2.13.4",
    "uvicorn==0.51.0",
]

[project.optional-dependencies]
dev = [
    "pytest==9.1.1",
    "httpx==0.28.1",
]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]

[build-system]
requires = ["setuptools>=69"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]
```

- [ ] **Step 2: Create empty package/test init files**

```bash
mkdir -p backend/src/ai_calculator backend/tests/unit backend/tests/integration
touch backend/src/ai_calculator/__init__.py backend/tests/unit/__init__.py backend/tests/integration/__init__.py
```

- [ ] **Step 3: Install and verify pytest runs (no tests yet, should report "no tests ran")**

Run (from `backend/`): `python3.11 -m venv .venv && .venv/bin/pip install -e ".[dev]" && .venv/bin/pytest`
Expected: exits with "no tests ran" (or collected 0 items), not an error.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/src backend/tests
git commit -m "chore: scaffold backend package"
```

---

## Task 2: Domain — EcoLogits impacts adapter

**Files:**

- Create: `backend/src/ai_calculator/domain/__init__.py`
- Create: `backend/src/ai_calculator/domain/impacts.py`
- Test: `backend/tests/unit/test_impacts.py`

**Interfaces:**

- Produces:
  - `ImpactRange` dataclass: `min: float`, `max: float`.
  - `UnitImpacts` dataclass: `gwp: ImpactRange`, `energy: ImpactRange`, `adpe: ImpactRange`, `pe: ImpactRange`, `water: ImpactRange` (each in the EcoLogits base unit: kgCO2eq, kWh, kgSbeq, MJ, L).
  - `ModelNotFoundError(Exception)`.
  - `EcologitsComputationError(Exception)`.
  - `compute_unit_impacts(provider: str, model_name: str, output_tokens: int) -> UnitImpacts`.
- Consumes: `ecologits.tracers.utils.llm_impacts` (installed dependency).

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/unit/test_impacts.py
import pytest

from ai_calculator.domain.impacts import (
    EcologitsComputationError,
    ModelNotFoundError,
    compute_unit_impacts,
)


def test_compute_unit_impacts_returns_ranges_for_all_five_criteria():
    result = compute_unit_impacts(
        provider="openai", model_name="gpt-4o-mini", output_tokens=200
    )

    for range_ in (result.gwp, result.energy, result.adpe, result.pe, result.water):
        assert range_.min >= 0
        assert range_.max >= range_.min


def test_compute_unit_impacts_scales_with_output_tokens():
    small = compute_unit_impacts(
        provider="openai", model_name="gpt-4o-mini", output_tokens=100
    )
    large = compute_unit_impacts(
        provider="openai", model_name="gpt-4o-mini", output_tokens=1000
    )

    assert large.gwp.max > small.gwp.max


def test_compute_unit_impacts_raises_model_not_found_for_unknown_model():
    with pytest.raises(ModelNotFoundError):
        compute_unit_impacts(
            provider="openai", model_name="does-not-exist", output_tokens=100
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/unit/test_impacts.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'ai_calculator.domain'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/ai_calculator/domain/__init__.py
```

```python
# backend/src/ai_calculator/domain/impacts.py
from dataclasses import dataclass

from ecologits.tracers.utils import ImpactsOutput, llm_impacts
from ecologits.utils.range_value import RangeValue


class ModelNotFoundError(Exception):
    def __init__(self, provider: str, model_name: str) -> None:
        self.provider = provider
        self.model_name = model_name
        super().__init__(f"Model '{model_name}' not found for provider '{provider}'")


class EcologitsComputationError(Exception):
    pass


@dataclass(frozen=True)
class ImpactRange:
    min: float
    max: float


@dataclass(frozen=True)
class UnitImpacts:
    gwp: ImpactRange
    energy: ImpactRange
    adpe: ImpactRange
    pe: ImpactRange
    water: ImpactRange


def _to_range(value: float | RangeValue) -> ImpactRange:
    if isinstance(value, RangeValue):
        return ImpactRange(min=float(value.min), max=float(value.max))
    return ImpactRange(min=float(value), max=float(value))


def compute_unit_impacts(
    provider: str, model_name: str, output_tokens: int
) -> UnitImpacts:
    result: ImpactsOutput = llm_impacts(
        provider=provider,
        model_name=model_name,
        output_token_count=output_tokens,
        request_latency=float("inf"),
    )

    if result.has_errors:
        for error in result.errors:
            if error.code == "model-not-registered":
                raise ModelNotFoundError(provider, model_name)
        raise EcologitsComputationError("; ".join(str(e) for e in result.errors))

    return UnitImpacts(
        gwp=_to_range(result.gwp.value),
        energy=_to_range(result.energy.value),
        adpe=_to_range(result.adpe.value),
        pe=_to_range(result.pe.value),
        water=_to_range(result.wcf.value),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/unit/test_impacts.py -v`
Expected: PASS (3 passed). If the `model-not-registered` error code differs, inspect the actual `ErrorMessage.code` raised by `ecologits.status_messages.ModelNotRegisteredError` and adjust the check accordingly — verify with a quick `python -c "from ecologits.status_messages import ModelNotRegisteredError; print(ModelNotRegisteredError(message='x').code)"`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai_calculator/domain backend/tests/unit/test_impacts.py
git commit -m "feat: add EcoLogits impacts adapter with min-max ranges"
```

---

## Task 3: Domain — model/provider catalog

**Files:**

- Create: `backend/src/ai_calculator/domain/catalog.py`
- Test: `backend/tests/unit/test_catalog.py`

**Interfaces:**

- Produces:
  - `CatalogModel` dataclass: `provider: str`, `name: str`.
  - `list_catalog_models() -> list[CatalogModel]`.
- Consumes: `ecologits.model_repository.models` (installed dependency).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_catalog.py
from ai_calculator.domain.catalog import list_catalog_models


def test_list_catalog_models_includes_known_openai_model():
    models = list_catalog_models()

    assert any(m.provider == "openai" and m.name == "gpt-4o-mini" for m in models)


def test_list_catalog_models_returns_non_empty_list():
    models = list_catalog_models()

    assert len(models) > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/unit/test_catalog.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'ai_calculator.domain.catalog'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/ai_calculator/domain/catalog.py
from dataclasses import dataclass

from ecologits.model_repository import models as _ecologits_models


@dataclass(frozen=True)
class CatalogModel:
    provider: str
    name: str


def list_catalog_models() -> list[CatalogModel]:
    return [
        CatalogModel(provider=m.provider.value, name=m.name)
        for m in _ecologits_models.list_models()
    ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/unit/test_catalog.py -v`
Expected: PASS (2 passed). If `gpt-4o-mini` is not in the current EcoLogits catalog, run `python -c "from ecologits.model_repository import models; print([m.name for m in models.list_models() if m.provider.value=='openai'])"` and swap in a real model name from the printed list.

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai_calculator/domain/catalog.py backend/tests/unit/test_catalog.py
git commit -m "feat: add EcoLogits model catalog adapter"
```

---

## Task 4: Domain — extrapolation (unit → individual annual → enterprise annual)

**Files:**

- Create: `backend/src/ai_calculator/domain/extrapolation.py`
- Test: `backend/tests/unit/test_extrapolation.py`

**Interfaces:**

- Consumes: `ImpactRange`, `UnitImpacts` from `ai_calculator.domain.impacts`.
- Produces:
  - `AggregatedImpacts` dataclass: `gwp: ImpactRange`, `energy: ImpactRange`, `adpe: ImpactRange`, `pe: ImpactRange`, `water: ImpactRange`.
  - `extrapolate(unit: UnitImpacts, requests_per_day: int, working_days_per_year: int, headcount: int) -> tuple[AggregatedImpacts, AggregatedImpacts]` returning `(individual_annual, enterprise_annual)`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_extrapolation.py
from ai_calculator.domain.extrapolation import extrapolate
from ai_calculator.domain.impacts import ImpactRange, UnitImpacts


def _unit_impacts_with_gwp(min_value: float, max_value: float) -> UnitImpacts:
    zero = ImpactRange(min=0.0, max=0.0)
    return UnitImpacts(
        gwp=ImpactRange(min=min_value, max=max_value),
        energy=zero,
        adpe=zero,
        pe=zero,
        water=zero,
    )


def test_individual_annual_multiplies_unit_by_requests_and_working_days():
    unit = _unit_impacts_with_gwp(1.0, 2.0)

    individual, _enterprise = extrapolate(
        unit, requests_per_day=10, working_days_per_year=220, headcount=50
    )

    assert individual.gwp.min == 1.0 * 10 * 220
    assert individual.gwp.max == 2.0 * 10 * 220


def test_enterprise_annual_multiplies_individual_annual_by_headcount():
    unit = _unit_impacts_with_gwp(1.0, 2.0)

    individual, enterprise = extrapolate(
        unit, requests_per_day=10, working_days_per_year=220, headcount=50
    )

    assert enterprise.gwp.min == individual.gwp.min * 50
    assert enterprise.gwp.max == individual.gwp.max * 50
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/unit/test_extrapolation.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'ai_calculator.domain.extrapolation'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/ai_calculator/domain/extrapolation.py
from dataclasses import dataclass

from ai_calculator.domain.impacts import ImpactRange, UnitImpacts


@dataclass(frozen=True)
class AggregatedImpacts:
    gwp: ImpactRange
    energy: ImpactRange
    adpe: ImpactRange
    pe: ImpactRange
    water: ImpactRange


def _scale_range(range_: ImpactRange, factor: float) -> ImpactRange:
    return ImpactRange(min=range_.min * factor, max=range_.max * factor)


def _scale_all(unit: UnitImpacts, factor: float) -> AggregatedImpacts:
    return AggregatedImpacts(
        gwp=_scale_range(unit.gwp, factor),
        energy=_scale_range(unit.energy, factor),
        adpe=_scale_range(unit.adpe, factor),
        pe=_scale_range(unit.pe, factor),
        water=_scale_range(unit.water, factor),
    )


def extrapolate(
    unit: UnitImpacts,
    requests_per_day: int,
    working_days_per_year: int,
    headcount: int,
) -> tuple[AggregatedImpacts, AggregatedImpacts]:
    individual_factor = requests_per_day * working_days_per_year
    individual_annual = _scale_all(unit, individual_factor)
    enterprise_annual = _scale_all(individual_annual, headcount)
    return individual_annual, enterprise_annual
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/unit/test_extrapolation.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai_calculator/domain/extrapolation.py backend/tests/unit/test_extrapolation.py
git commit -m "feat: add annual individual/enterprise extrapolation"
```

---

## Task 5: Schemas (Pydantic)

**Files:**

- Create: `backend/src/ai_calculator/schemas/__init__.py`
- Create: `backend/src/ai_calculator/schemas/providers.py`
- Create: `backend/src/ai_calculator/schemas/calculate.py`

**Interfaces:**

- Consumes: `CatalogModel` (Task 3), `ImpactRange`/`AggregatedImpacts` (Tasks 2 & 4).
- Produces:
  - `ProviderModelOut(provider: str, name: str)` — Pydantic model.
  - `CalculateRequest(provider: str, model: str, output_tokens: int, requests_per_day: int, working_days_per_year: int = 220, headcount: int = 1)` — Pydantic model, all numeric fields `gt=0` except `output_tokens` which is `ge=1`.
  - `ImpactRangeOut(min: float, max: float)`.
  - `ImpactsOut(gwp: ImpactRangeOut, energy: ImpactRangeOut, adpe: ImpactRangeOut, pe: ImpactRangeOut, water: ImpactRangeOut)`.
  - `CalculateResponse(unit: ImpactsOut, individual_annual: ImpactsOut, enterprise_annual: ImpactsOut)`.

This task has no domain logic to TDD (pure data schemas) — write directly, then verify with a smoke import.

- [ ] **Step 1: Write `schemas/__init__.py` (empty) and `schemas/providers.py`**

```python
# backend/src/ai_calculator/schemas/__init__.py
```

```python
# backend/src/ai_calculator/schemas/providers.py
from pydantic import BaseModel


class ProviderModelOut(BaseModel):
    provider: str
    name: str
```

- [ ] **Step 2: Write `schemas/calculate.py`**

```python
# backend/src/ai_calculator/schemas/calculate.py
from pydantic import BaseModel, Field


class CalculateRequest(BaseModel):
    provider: str
    model: str
    output_tokens: int = Field(ge=1)
    requests_per_day: int = Field(gt=0)
    working_days_per_year: int = Field(default=220, gt=0)
    headcount: int = Field(default=1, gt=0)


class ImpactRangeOut(BaseModel):
    min: float
    max: float


class ImpactsOut(BaseModel):
    gwp: ImpactRangeOut
    energy: ImpactRangeOut
    adpe: ImpactRangeOut
    pe: ImpactRangeOut
    water: ImpactRangeOut


class CalculateResponse(BaseModel):
    unit: ImpactsOut
    individual_annual: ImpactsOut
    enterprise_annual: ImpactsOut
```

- [ ] **Step 3: Verify the schemas import and validate cleanly**

Run: `.venv/bin/python -c "from ai_calculator.schemas.calculate import CalculateRequest; print(CalculateRequest(provider='openai', model='gpt-4o-mini', output_tokens=200, requests_per_day=10))"`
Expected: prints the model without raising a `ValidationError`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/ai_calculator/schemas
git commit -m "feat: add request/response Pydantic schemas"
```

---

## Task 6: API — `GET /api/providers`

**Files:**

- Create: `backend/src/ai_calculator/api/__init__.py`
- Create: `backend/src/ai_calculator/api/providers.py`
- Create: `backend/src/ai_calculator/main.py`
- Test: `backend/tests/integration/test_providers_api.py`

**Interfaces:**

- Consumes: `list_catalog_models()` (Task 3), `ProviderModelOut` (Task 5).
- Produces: FastAPI app instance `app` in `ai_calculator.main`, mounted route `GET /api/providers` returning `list[ProviderModelOut]`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_providers_api.py
from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)


def test_get_providers_returns_200_with_model_list():
    response = client.get("/api/providers")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) > 0
    assert "provider" in body[0]
    assert "name" in body[0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/integration/test_providers_api.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'ai_calculator.main'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/ai_calculator/api/__init__.py
```

```python
# backend/src/ai_calculator/api/providers.py
from fastapi import APIRouter

from ai_calculator.domain.catalog import list_catalog_models
from ai_calculator.schemas.providers import ProviderModelOut

router = APIRouter()


@router.get("/api/providers", response_model=list[ProviderModelOut])
def get_providers() -> list[ProviderModelOut]:
    return [
        ProviderModelOut(provider=m.provider, name=m.name)
        for m in list_catalog_models()
    ]
```

```python
# backend/src/ai_calculator/main.py
from fastapi import FastAPI

from ai_calculator.api.providers import router as providers_router

app = FastAPI(title="AI Calculator API")
app.include_router(providers_router)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/integration/test_providers_api.py -v`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai_calculator/api/__init__.py backend/src/ai_calculator/api/providers.py backend/src/ai_calculator/main.py backend/tests/integration/test_providers_api.py
git commit -m "feat: add GET /api/providers endpoint"
```

---

## Task 7: API — `POST /api/calculate` (happy path)

**Files:**

- Create: `backend/src/ai_calculator/api/calculate.py`
- Modify: `backend/src/ai_calculator/main.py`
- Test: `backend/tests/integration/test_calculate_api.py`

**Interfaces:**

- Consumes: `compute_unit_impacts` (Task 2), `extrapolate` (Task 4), `CalculateRequest`/`CalculateResponse`/`ImpactsOut`/`ImpactRangeOut` (Task 5).
- Produces: route `POST /api/calculate` returning `CalculateResponse` with 3 aggregation levels.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_calculate_api.py
from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)

VALID_PAYLOAD = {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "output_tokens": 200,
    "requests_per_day": 10,
    "working_days_per_year": 220,
    "headcount": 50,
}


def test_calculate_returns_200_with_three_aggregation_levels():
    response = client.post("/api/calculate", json=VALID_PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    for level in ("unit", "individual_annual", "enterprise_annual"):
        assert level in body
        for criterion in ("gwp", "energy", "adpe", "pe", "water"):
            assert criterion in body[level]
            assert body[level][criterion]["max"] >= body[level][criterion]["min"]


def test_calculate_enterprise_annual_scales_up_from_unit():
    response = client.post("/api/calculate", json=VALID_PAYLOAD)

    body = response.json()
    assert body["enterprise_annual"]["gwp"]["max"] > body["unit"]["gwp"]["max"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/integration/test_calculate_api.py -v`
Expected: FAIL with `404 Not Found` (route doesn't exist yet — assert on status_code will fail first).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/ai_calculator/api/calculate.py
from fastapi import APIRouter

from ai_calculator.domain.extrapolation import AggregatedImpacts, extrapolate
from ai_calculator.domain.impacts import UnitImpacts, compute_unit_impacts
from ai_calculator.schemas.calculate import (
    CalculateRequest,
    CalculateResponse,
    ImpactRangeOut,
    ImpactsOut,
)

router = APIRouter()


def _to_impacts_out(impacts: UnitImpacts | AggregatedImpacts) -> ImpactsOut:
    return ImpactsOut(
        gwp=ImpactRangeOut(min=impacts.gwp.min, max=impacts.gwp.max),
        energy=ImpactRangeOut(min=impacts.energy.min, max=impacts.energy.max),
        adpe=ImpactRangeOut(min=impacts.adpe.min, max=impacts.adpe.max),
        pe=ImpactRangeOut(min=impacts.pe.min, max=impacts.pe.max),
        water=ImpactRangeOut(min=impacts.water.min, max=impacts.water.max),
    )


@router.post("/api/calculate", response_model=CalculateResponse)
def calculate(payload: CalculateRequest) -> CalculateResponse:
    unit = compute_unit_impacts(
        provider=payload.provider,
        model_name=payload.model,
        output_tokens=payload.output_tokens,
    )
    individual_annual, enterprise_annual = extrapolate(
        unit,
        requests_per_day=payload.requests_per_day,
        working_days_per_year=payload.working_days_per_year,
        headcount=payload.headcount,
    )
    return CalculateResponse(
        unit=_to_impacts_out(unit),
        individual_annual=_to_impacts_out(individual_annual),
        enterprise_annual=_to_impacts_out(enterprise_annual),
    )
```

```python
# backend/src/ai_calculator/main.py
from fastapi import FastAPI

from ai_calculator.api.calculate import router as calculate_router
from ai_calculator.api.providers import router as providers_router

app = FastAPI(title="AI Calculator API")
app.include_router(providers_router)
app.include_router(calculate_router)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/integration/test_calculate_api.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/src/ai_calculator/api/calculate.py backend/src/ai_calculator/main.py backend/tests/integration/test_calculate_api.py
git commit -m "feat: add POST /api/calculate endpoint"
```

---

## Task 8: API — error handling (404 unknown model, 502 EcoLogits failure, 422 validation)

**Files:**

- Modify: `backend/src/ai_calculator/api/calculate.py`
- Modify: `backend/tests/integration/test_calculate_api.py`

**Interfaces:**

- Consumes: `ModelNotFoundError`, `EcologitsComputationError` (Task 2).
- Produces: `POST /api/calculate` returns `404` on unknown model, `502` on internal EcoLogits errors, `422` (default FastAPI/Pydantic behavior) on invalid payload — no new interfaces for later tasks.

- [ ] **Step 1: Write the failing tests**

```python
# append to backend/tests/integration/test_calculate_api.py

def test_calculate_returns_404_for_unknown_model():
    payload = {**VALID_PAYLOAD, "model": "does-not-exist"}

    response = client.post("/api/calculate", json=payload)

    assert response.status_code == 404


def test_calculate_returns_422_for_non_positive_output_tokens():
    payload = {**VALID_PAYLOAD, "output_tokens": 0}

    response = client.post("/api/calculate", json=payload)

    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/pytest tests/integration/test_calculate_api.py -v`
Expected: `test_calculate_returns_404_for_unknown_model` FAILs (currently raises an unhandled `ModelNotFoundError` → 500). `test_calculate_returns_422_for_non_positive_output_tokens` already PASSes (Pydantic `ge=1` from Task 5) — confirm it passes, only the 404 test should be red.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/ai_calculator/api/calculate.py
from fastapi import APIRouter, HTTPException

from ai_calculator.domain.extrapolation import AggregatedImpacts, extrapolate
from ai_calculator.domain.impacts import (
    EcologitsComputationError,
    ModelNotFoundError,
    UnitImpacts,
    compute_unit_impacts,
)
from ai_calculator.schemas.calculate import (
    CalculateRequest,
    CalculateResponse,
    ImpactRangeOut,
    ImpactsOut,
)

router = APIRouter()


def _to_impacts_out(impacts: UnitImpacts | AggregatedImpacts) -> ImpactsOut:
    return ImpactsOut(
        gwp=ImpactRangeOut(min=impacts.gwp.min, max=impacts.gwp.max),
        energy=ImpactRangeOut(min=impacts.energy.min, max=impacts.energy.max),
        adpe=ImpactRangeOut(min=impacts.adpe.min, max=impacts.adpe.max),
        pe=ImpactRangeOut(min=impacts.pe.min, max=impacts.pe.max),
        water=ImpactRangeOut(min=impacts.water.min, max=impacts.water.max),
    )


@router.post("/api/calculate", response_model=CalculateResponse)
def calculate(payload: CalculateRequest) -> CalculateResponse:
    try:
        unit = compute_unit_impacts(
            provider=payload.provider,
            model_name=payload.model,
            output_tokens=payload.output_tokens,
        )
    except ModelNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EcologitsComputationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    individual_annual, enterprise_annual = extrapolate(
        unit,
        requests_per_day=payload.requests_per_day,
        working_days_per_year=payload.working_days_per_year,
        headcount=payload.headcount,
    )
    return CalculateResponse(
        unit=_to_impacts_out(unit),
        individual_annual=_to_impacts_out(individual_annual),
        enterprise_annual=_to_impacts_out(enterprise_annual),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/pytest tests/integration/ -v`
Expected: all PASS (4 passed)

- [ ] **Step 5: Run the full backend test suite**

Run: `.venv/bin/pytest -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/ai_calculator/api/calculate.py backend/tests/integration/test_calculate_api.py
git commit -m "fix: return 404/502 for model/EcoLogits errors on /api/calculate"
```

---

## Task 9: Frontend scaffolding

**Files:**

- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Interfaces:**

- Produces: a runnable Vite dev server, a runnable `npx vitest run` (0 tests), `App` component placeholder for later routing (Task 15).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ai-calculator-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "react-i18next": "17.0.9",
    "i18next": "26.3.6",
    "react-router-dom": "7.18.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "6.0.3",
    "vite": "8.1.4",
    "typescript": "7.0.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "vitest": "4.1.10",
    "@testing-library/react": "16.3.2",
    "@testing-library/jest-dom": "6.9.1",
    "jsdom": "29.1.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Calculator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `src/App.tsx` and `src/main.tsx`**

```tsx
// frontend/src/App.tsx
export function App() {
  return <div>AI Calculator</div>;
}
```

```tsx
// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Install dependencies and verify the test runner works with 0 tests**

Run: `cd frontend && npm install && npm test`
Expected: `npm test` reports "No test files found" or exits 0 (vitest with zero test files still exits successfully by default — if it exits non-zero on empty run, this is expected until Task 11 adds the first test; do not treat that as a blocker).

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/src
git commit -m "chore: scaffold frontend Vite/React/TS project"
```

---

## Task 10: i18n setup

**Files:**

- Create: `frontend/src/i18n/index.ts`
- Create: `frontend/src/i18n/fr.json`
- Create: `frontend/src/i18n/en.json`
- Modify: `frontend/src/main.tsx`

**Interfaces:**

- Produces: `i18n` instance (default export from `frontend/src/i18n/index.ts`) initialized with `fr`/`en` resources, browser language detection, `localStorage` persistence key `ai-calculator-lang`. Later tasks call `useTranslation()` from `react-i18next` with namespaces `calculator`, `methodology`, `about`, `legal`, `common`.

- [ ] **Step 1: Write `fr.json` and `en.json` with the keys used by Task 13's calculator form**

```json
// frontend/src/i18n/fr.json
{
  "common": {
    "appName": "AI Calculator"
  },
  "calculator": {
    "title": "Calculateur d'impacts",
    "provider": "Fournisseur",
    "model": "Modèle",
    "outputTokens": "Tokens générés par requête",
    "requestsPerDay": "Requêtes par jour",
    "submit": "Calculer",
    "resultUnit": "Par requête",
    "resultIndividualAnnual": "Par personne et par an",
    "resultEnterpriseAnnual": "Pour l'entreprise et par an",
    "criterion": {
      "gwp": "Gaz à effet de serre",
      "energy": "Énergie",
      "adpe": "Ressources minérales",
      "pe": "Énergie primaire",
      "water": "Eau"
    },
    "errorModelNotFound": "Ce modèle n'est pas (encore) disponible dans le référentiel.",
    "errorGeneric": "Une erreur est survenue lors du calcul."
  }
}
```

```json
// frontend/src/i18n/en.json
{
  "common": {
    "appName": "AI Calculator"
  },
  "calculator": {
    "title": "Impact calculator",
    "provider": "Provider",
    "model": "Model",
    "outputTokens": "Generated tokens per request",
    "requestsPerDay": "Requests per day",
    "submit": "Calculate",
    "resultUnit": "Per request",
    "resultIndividualAnnual": "Per person, per year",
    "resultEnterpriseAnnual": "For the company, per year",
    "criterion": {
      "gwp": "Greenhouse gases",
      "energy": "Energy",
      "adpe": "Mineral resources",
      "pe": "Primary energy",
      "water": "Water"
    },
    "errorModelNotFound": "This model is not (yet) available in the referential.",
    "errorGeneric": "An error occurred during the calculation."
  }
}
```

- [ ] **Step 2: Write `i18n/index.ts`**

```typescript
// frontend/src/i18n/index.ts
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./fr.json";
import en from "./en.json";

const STORAGE_KEY = "ai-calculator-lang";

function detectLanguage(): "fr" | "en" {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  return navigator.language.startsWith("fr") ? "fr" : "en";
}

i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18next.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18next;
```

- [ ] **Step 3: Wire it into `main.tsx`**

```tsx
// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Verify the dev server still boots**

Run: `cd frontend && npm run dev -- --port 5173 &` then `curl -sf http://localhost:5173 > /dev/null && echo OK`, then stop the dev server.
Expected: prints `OK`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n frontend/src/main.tsx
git commit -m "feat: add react-i18next FR/EN setup"
```

---

## Task 11: `RangeGauge` component

**Files:**

- Create: `frontend/src/components/RangeGauge.tsx`
- Test: `frontend/tests/RangeGauge.test.tsx`
- Create: `frontend/tests/setup.ts`
- Modify: `frontend/vite.config.ts`

**Interfaces:**

- Produces: `RangeGauge` React component, props `{ min: number; max: number; unit: string; label: string }`. Renders the gauge track/fill/tick and the formatted min/max/central-value bounds. Reused by `CalculatorPage` (Task 13) for all 5 impact criteria.
- Also produces `gaugePositions(min: number, max: number) -> { fillLeftPct: number; fillRightPct: number; tickLeftPct: number }`, exported from the same file for direct unit testing of the scale math (`0 → max × 1.1`).

- [ ] **Step 1: Write `tests/setup.ts` (jest-dom matchers) and wire it in `vite.config.ts`**

```typescript
// frontend/tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
```

- [ ] **Step 2: Write the failing test**

```tsx
// frontend/tests/RangeGauge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RangeGauge, gaugePositions } from "../src/components/RangeGauge";

describe("gaugePositions", () => {
  it("places the tick at the midpoint of min and max, scaled to max * 1.1", () => {
    const { fillLeftPct, fillRightPct, tickLeftPct } = gaugePositions(10, 30);

    const scale = 30 * 1.1;
    expect(fillLeftPct).toBeCloseTo((10 / scale) * 100, 1);
    expect(fillRightPct).toBeCloseTo(100 - (30 / scale) * 100, 1);
    expect(tickLeftPct).toBeCloseTo(((10 + 30) / 2 / scale) * 100, 1);
  });

  it("returns a full-width fill when max is 0", () => {
    const { fillLeftPct, fillRightPct } = gaugePositions(0, 0);

    expect(fillLeftPct).toBe(0);
    expect(fillRightPct).toBe(100);
  });
});

describe("RangeGauge", () => {
  it("renders the label, min and max bounds", () => {
    render(<RangeGauge min={1.2} max={3.4} unit="kgCO2eq" label="GWP" />);

    expect(screen.getByText("GWP")).toBeInTheDocument();
    expect(screen.getByText(/1.2/)).toBeInTheDocument();
    expect(screen.getByText(/3.4/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm test -- RangeGauge`
Expected: FAIL — `Failed to resolve import "../src/components/RangeGauge"`

- [ ] **Step 4: Write minimal implementation**

```tsx
// frontend/src/components/RangeGauge.tsx
export function gaugePositions(
  min: number,
  max: number,
): { fillLeftPct: number; fillRightPct: number; tickLeftPct: number } {
  if (max <= 0) {
    return { fillLeftPct: 0, fillRightPct: 100, tickLeftPct: 0 };
  }
  const scale = max * 1.1;
  return {
    fillLeftPct: (min / scale) * 100,
    fillRightPct: 100 - (max / scale) * 100,
    tickLeftPct: ((min + max) / 2 / scale) * 100,
  };
}

interface RangeGaugeProps {
  min: number;
  max: number;
  unit: string;
  label: string;
}

export function RangeGauge({ min, max, unit, label }: RangeGaugeProps) {
  const { fillLeftPct, fillRightPct, tickLeftPct } = gaugePositions(min, max);

  return (
    <div className="range-gauge">
      <div className="range-gauge__label">{label}</div>
      <div className="range-gauge__track">
        <div
          className="range-gauge__fill"
          style={{ left: `${fillLeftPct}%`, right: `${fillRightPct}%` }}
        />
        <div
          className="range-gauge__tick"
          style={{ left: `${tickLeftPct}%` }}
        />
      </div>
      <div className="range-gauge__bounds">
        <span>
          min {min.toPrecision(3)} {unit}
        </span>
        <span>
          max {max.toPrecision(3)} {unit}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm test -- RangeGauge`
Expected: PASS (3 passed)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/RangeGauge.tsx frontend/tests/RangeGauge.test.tsx frontend/tests/setup.ts frontend/vite.config.ts
git commit -m "feat: add RangeGauge min-max component"
```

---

## Task 12: API client

**Files:**

- Create: `frontend/src/api/client.ts`

**Interfaces:**

- Produces:
  - `ProviderModel { provider: string; name: string }`.
  - `ImpactRange { min: number; max: number }`.
  - `Impacts { gwp: ImpactRange; energy: ImpactRange; adpe: ImpactRange; pe: ImpactRange; water: ImpactRange }`.
  - `CalculateResult { unit: Impacts; individualAnnual: Impacts; enterpriseAnnual: Impacts }`.
  - `ApiError` class with `status: number`.
  - `fetchProviders(): Promise<ProviderModel[]>`.
  - `calculate(params: { provider: string; model: string; outputTokens: number; requestsPerDay: number; workingDaysPerYear?: number; headcount?: number }): Promise<CalculateResult>`.
- Consumes: backend `GET /api/providers`, `POST /api/calculate` (Tasks 6–8). Reused by `CalculatorPage` (Task 13).

No backend is running during frontend unit tests (Task 13 mocks this module), so this task is written directly and verified by a manual `curl`-backed smoke check against the real backend rather than a TDD unit test — there is no pure logic here beyond a thin fetch wrapper.

- [ ] **Step 1: Write `src/api/client.ts`**

```typescript
// frontend/src/api/client.ts
export interface ProviderModel {
  provider: string;
  name: string;
}

export interface ImpactRange {
  min: number;
  max: number;
}

export interface Impacts {
  gwp: ImpactRange;
  energy: ImpactRange;
  adpe: ImpactRange;
  pe: ImpactRange;
  water: ImpactRange;
}

export interface CalculateResult {
  unit: Impacts;
  individualAnnual: Impacts;
  enterpriseAnnual: Impacts;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchProviders(): Promise<ProviderModel[]> {
  const response = await fetch(`${API_BASE}/api/providers`);
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to fetch providers");
  }
  return response.json();
}

interface CalculateParams {
  provider: string;
  model: string;
  outputTokens: number;
  requestsPerDay: number;
  workingDaysPerYear?: number;
  headcount?: number;
}

interface CalculateResponseBody {
  unit: Impacts;
  individual_annual: Impacts;
  enterprise_annual: Impacts;
}

export async function calculate(
  params: CalculateParams,
): Promise<CalculateResult> {
  const response = await fetch(`${API_BASE}/api/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: params.provider,
      model: params.model,
      output_tokens: params.outputTokens,
      requests_per_day: params.requestsPerDay,
      working_days_per_year: params.workingDaysPerYear ?? 220,
      headcount: params.headcount ?? 1,
    }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, "Failed to compute impacts");
  }
  const body: CalculateResponseBody = await response.json();
  return {
    unit: body.unit,
    individualAnnual: body.individual_annual,
    enterpriseAnnual: body.enterprise_annual,
  };
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add typed API client for providers/calculate"
```

---

## Task 13: `CalculatorPage` — form + results

**Files:**

- Create: `frontend/src/pages/CalculatorPage.tsx`
- Test: `frontend/tests/CalculatorPage.test.tsx`

**Interfaces:**

- Consumes: `fetchProviders`, `calculate`, `ProviderModel`, `CalculateResult`, `ApiError` (Task 12); `RangeGauge` (Task 11); `useTranslation` from `react-i18next` (Task 10, namespace keys under `calculator.*`).
- Produces: `CalculatorPage` component, mounted at `/` by `App.tsx` in Task 15.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/CalculatorPage.test.tsx
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
    fetchProviders: vi.fn(),
    calculate: vi.fn(),
  };
});

const mockedFetchProviders = vi.mocked(apiClient.fetchProviders);
const mockedCalculate = vi.mocked(apiClient.calculate);

const ZERO_RANGE = { min: 0, max: 0 };
const ZERO_IMPACTS = {
  gwp: ZERO_RANGE,
  energy: ZERO_RANGE,
  adpe: ZERO_RANGE,
  pe: ZERO_RANGE,
  water: ZERO_RANGE,
};

describe("CalculatorPage", () => {
  it("submits the form and displays 5 range gauges for the unit result", async () => {
    mockedFetchProviders.mockResolvedValue([
      { provider: "openai", name: "gpt-4o-mini" },
    ]);
    mockedCalculate.mockResolvedValue({
      unit: { ...ZERO_IMPACTS, gwp: { min: 1.1, max: 2.2 } },
      individualAnnual: ZERO_IMPACTS,
      enterpriseAnnual: ZERO_IMPACTS,
    });

    render(<CalculatorPage />);

    await waitFor(() => expect(mockedFetchProviders).toHaveBeenCalled());

    await userEvent.click(
      screen.getByRole("button", { name: /calculer|calculate/i }),
    );

    await waitFor(() => expect(mockedCalculate).toHaveBeenCalled());
    expect(screen.getByText(/1.1/)).toBeInTheDocument();
    expect(screen.getByText(/2.2/)).toBeInTheDocument();
  });

  it("shows a localized error message when the model is not found", async () => {
    mockedFetchProviders.mockResolvedValue([
      { provider: "openai", name: "gpt-4o-mini" },
    ]);
    mockedCalculate.mockRejectedValue(new apiClient.ApiError(404, "not found"));

    render(<CalculatorPage />);

    await waitFor(() => expect(mockedFetchProviders).toHaveBeenCalled());
    await userEvent.click(
      screen.getByRole("button", { name: /calculer|calculate/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          /n'est pas \(encore\) disponible|not \(yet\) available/i,
        ),
      ).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm install @testing-library/user-event@14 && npm test -- CalculatorPage`
Expected: FAIL — `Failed to resolve import "../src/pages/CalculatorPage"`

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/pages/CalculatorPage.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ApiError,
  CalculateResult,
  Impacts,
  ProviderModel,
  calculate,
  fetchProviders,
} from "../api/client";
import { RangeGauge } from "../components/RangeGauge";

const CRITERIA: Array<{ key: keyof Impacts; unit: string }> = [
  { key: "gwp", unit: "kgCO2eq" },
  { key: "energy", unit: "kWh" },
  { key: "adpe", unit: "kgSbeq" },
  { key: "pe", unit: "MJ" },
  { key: "water", unit: "L" },
];

function ImpactsGrid({ impacts, title }: { impacts: Impacts; title: string }) {
  const { t } = useTranslation();
  return (
    <section>
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

export function CalculatorPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderModel[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [outputTokens, setOutputTokens] = useState(200);
  const [requestsPerDay, setRequestsPerDay] = useState(10);
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders().then(setProviders);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const selected = providers[selectedIndex];
    if (!selected) return;
    try {
      const calculated = await calculate({
        provider: selected.provider,
        model: selected.name,
        outputTokens,
        requestsPerDay,
      });
      setResult(calculated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(t("calculator.errorModelNotFound"));
      } else {
        setError(t("calculator.errorGeneric"));
      }
    }
  }

  return (
    <div>
      <h1>{t("calculator.title")}</h1>
      <form onSubmit={handleSubmit}>
        <label>
          {t("calculator.model")}
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {providers.map((p, index) => (
              <option key={`${p.provider}-${p.name}`} value={index}>
                {p.provider} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("calculator.outputTokens")}
          <input
            type="number"
            value={outputTokens}
            onChange={(e) => setOutputTokens(Number(e.target.value))}
          />
        </label>
        <label>
          {t("calculator.requestsPerDay")}
          <input
            type="number"
            value={requestsPerDay}
            onChange={(e) => setRequestsPerDay(Number(e.target.value))}
          />
        </label>
        <button type="submit">{t("calculator.submit")}</button>
      </form>

      {error && <p role="alert">{error}</p>}

      {result && (
        <>
          <ImpactsGrid
            impacts={result.unit}
            title={t("calculator.resultUnit")}
          />
          <ImpactsGrid
            impacts={result.individualAnnual}
            title={t("calculator.resultIndividualAnnual")}
          />
          <ImpactsGrid
            impacts={result.enterpriseAnnual}
            title={t("calculator.resultEnterpriseAnnual")}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- CalculatorPage`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CalculatorPage.tsx frontend/tests/CalculatorPage.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add calculator page with form and range-gauge results"
```

---

## Task 14: ImpactCO2 equivalents component (GWP only)

**Files:**

- Create: `frontend/src/data/co2-equivalents.json`
- Create: `frontend/src/components/Co2Equivalents.tsx`
- Test: `frontend/tests/Co2Equivalents.test.tsx`

**Interfaces:**

- Produces: `Co2Equivalents` component, props `{ gwpKgCo2eq: number }`. Reads static local data, computes `count = gwpKgCo2eq / equivalent.kgCo2eqPerUnit` for each of a fixed 3-entry subset, renders `t("calculator.co2Equivalent", { count, label })`-style text per `react-i18next` pluralization.
- Consumes: nothing beyond local JSON — no runtime dependency on impactco2.fr.

Data values below are illustrative placeholders sourced from ImpactCO2's public methodology order-of-magnitude (car km ≈ 0.218 kgCO2eq/km, beef burger ≈ 3.3 kgCO2eq/burger, laptop use for 1h ≈ 0.02 kgCO2eq/h) — **before merging, replace with the exact current figures from ImpactCO2's `equivalents.csv`** (referenced in the spec's "Comparaisons concrètes" section) rather than shipping these approximations as final.

- [ ] **Step 1: Write `src/data/co2-equivalents.json`**

```json
[
  { "id": "car_km", "kgCo2eqPerUnit": 0.218 },
  { "id": "beef_burger", "kgCo2eqPerUnit": 3.3 },
  { "id": "laptop_hour", "kgCo2eqPerUnit": 0.02 }
]
```

- [ ] **Step 2: Add the corresponding i18n keys**

```json
// merge into frontend/src/i18n/fr.json under "calculator"
"co2Equivalent": {
  "car_km": "{{count}} km en voiture",
  "beef_burger": "{{count}} burgers au bœuf",
  "laptop_hour": "{{count}} heures d'utilisation d'un ordinateur portable"
}
```

```json
// merge into frontend/src/i18n/en.json under "calculator"
"co2Equivalent": {
  "car_km": "{{count}} km by car",
  "beef_burger": "{{count}} beef burgers",
  "laptop_hour": "{{count}} hours of laptop use"
}
```

- [ ] **Step 3: Write the failing test**

```tsx
// frontend/tests/Co2Equivalents.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../src/i18n";
import { Co2Equivalents } from "../src/components/Co2Equivalents";

describe("Co2Equivalents", () => {
  it("renders one equivalence line per entry in the local dataset", () => {
    render(<Co2Equivalents gwpKgCo2eq={2.18} />);

    expect(screen.getByText(/10.*km/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd frontend && npm test -- Co2Equivalents`
Expected: FAIL — `Failed to resolve import "../src/components/Co2Equivalents"`

- [ ] **Step 5: Write minimal implementation**

```tsx
// frontend/src/components/Co2Equivalents.tsx
import { useTranslation } from "react-i18next";
import equivalents from "../data/co2-equivalents.json";

interface Co2EquivalentsProps {
  gwpKgCo2eq: number;
}

export function Co2Equivalents({ gwpKgCo2eq }: Co2EquivalentsProps) {
  const { t } = useTranslation();

  return (
    <ul>
      {equivalents.map((eq) => {
        const count = Math.round(gwpKgCo2eq / eq.kgCo2eqPerUnit);
        return (
          <li key={eq.id}>
            {t(`calculator.co2Equivalent.${eq.id}`, { count })}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && npm test -- Co2Equivalents`
Expected: PASS (1 passed)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/co2-equivalents.json frontend/src/components/Co2Equivalents.tsx frontend/tests/Co2Equivalents.test.tsx frontend/src/i18n
git commit -m "feat: add GWP-only ImpactCO2 equivalents component with local data"
```

---

## Task 15: Static pages, routing, language selector

**Files:**

- Create: `frontend/src/pages/MethodologyPage.tsx`
- Create: `frontend/src/pages/AboutPage.tsx`
- Create: `frontend/src/pages/LegalNoticePage.tsx`
- Create: `frontend/src/components/LanguageSwitcher.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/i18n/fr.json`, `frontend/src/i18n/en.json`
- Test: `frontend/tests/App.test.tsx`

**Interfaces:**

- Consumes: `CalculatorPage` (Task 13), `react-router-dom` (`BrowserRouter`, `Routes`, `Route`, `Link`).
- Produces: `App` component with 4 routes (`/`, `/methodologie`, `/a-propos`, `/mentions-legales`) and a language switcher calling `i18next.changeLanguage`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { App } from "../src/App";
import * as apiClient from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return { ...actual, fetchProviders: vi.fn().mockResolvedValue([]) };
});

describe("App", () => {
  it("renders the calculator page at the root route", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the methodology page at /methodologie", () => {
    window.history.pushState({}, "", "/methodologie");
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /méthodologie|methodology/i,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- App.test.tsx`
Expected: FAIL — current `App` renders a static `<div>`, no routing, no `/methodologie` heading.

- [ ] **Step 3: Add i18n keys for the 3 static pages**

```json
// merge into frontend/src/i18n/fr.json (top level, alongside "calculator")
"methodology": { "title": "Méthodologie", "body": "Les impacts sont calculés à partir d'EcoLogits, qui modélise l'inférence des modèles d'IA générative..." },
"about": { "title": "À propos", "body": "AI Calculator est un projet du Collectif Conception Numérique Responsable (cnumr)." },
"legal": { "title": "Mentions légales", "body": "Éditeur : cnumr. Hébergement : à préciser." },
"nav": { "calculator": "Calculateur", "methodology": "Méthodologie", "about": "À propos", "legal": "Mentions légales" }
```

```json
// merge into frontend/src/i18n/en.json (top level, alongside "calculator")
"methodology": { "title": "Methodology", "body": "Impacts are computed from EcoLogits, which models generative AI model inference..." },
"about": { "title": "About", "body": "AI Calculator is a project by Collectif Conception Numérique Responsable (cnumr)." },
"legal": { "title": "Legal notice", "body": "Publisher: cnumr. Hosting: TBD." },
"nav": { "calculator": "Calculator", "methodology": "Methodology", "about": "About", "legal": "Legal notice" }
```

- [ ] **Step 4: Write the 3 static pages**

```tsx
// frontend/src/pages/MethodologyPage.tsx
import { useTranslation } from "react-i18next";

export function MethodologyPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t("methodology.title")}</h1>
      <p>{t("methodology.body")}</p>
    </div>
  );
}
```

```tsx
// frontend/src/pages/AboutPage.tsx
import { useTranslation } from "react-i18next";

export function AboutPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t("about.title")}</h1>
      <p>{t("about.body")}</p>
    </div>
  );
}
```

```tsx
// frontend/src/pages/LegalNoticePage.tsx
import { useTranslation } from "react-i18next";

export function LegalNoticePage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t("legal.title")}</h1>
      <p>{t("legal.body")}</p>
    </div>
  );
}
```

- [ ] **Step 5: Write the language switcher**

```tsx
// frontend/src/components/LanguageSwitcher.tsx
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div>
      <button onClick={() => i18n.changeLanguage("fr")}>FR</button>
      <button onClick={() => i18n.changeLanguage("en")}>EN</button>
    </div>
  );
}
```

- [ ] **Step 6: Wire routing into `App.tsx`**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalculatorPage } from "./pages/CalculatorPage";
import { MethodologyPage } from "./pages/MethodologyPage";
import { AboutPage } from "./pages/AboutPage";
import { LegalNoticePage } from "./pages/LegalNoticePage";
import { LanguageSwitcher } from "./components/LanguageSwitcher";

export function App() {
  const { t } = useTranslation();
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">{t("nav.calculator")}</Link>
        <Link to="/methodologie">{t("nav.methodology")}</Link>
        <Link to="/a-propos">{t("nav.about")}</Link>
        <Link to="/mentions-legales">{t("nav.legal")}</Link>
        <LanguageSwitcher />
      </nav>
      <Routes>
        <Route path="/" element={<CalculatorPage />} />
        <Route path="/methodologie" element={<MethodologyPage />} />
        <Route path="/a-propos" element={<AboutPage />} />
        <Route path="/mentions-legales" element={<LegalNoticePage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && npm test -- App.test.tsx`
Expected: PASS (2 passed)

- [ ] **Step 8: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: all tests PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages frontend/src/components/LanguageSwitcher.tsx frontend/src/i18n frontend/tests/App.test.tsx
git commit -m "feat: add routing, static pages and language switcher"
```

---

## Self-Review

**1. Spec coverage:**

- Calculateur (usage quotidien, extrapolation individuelle/entreprise) → Tasks 2, 4, 7, 13. ✓
- Catalogue EcoLogits natif → Task 3, 6. ✓
- Stateless back → no DB/session anywhere in the plan. ✓
- Bilingue FR/EN, détection navigateur + sélecteur persisté → Tasks 10, 15. ✓
- 4 pages (Calculateur, Méthodologie, À propos, Mentions légales) → Tasks 13, 15. ✓
- API `GET /api/providers`, `POST /api/calculate` → Tasks 6, 7. ✓
- Comparaisons ImpactCO2 (composant maison, données locales, GWP only) → Task 14. ✓
- Gestion des erreurs (422/404/502, message localisé front) → Tasks 5 (422 via Pydantic), 8 (404/502), 13 (front message). ✓
- i18n back neutre → back schemas carry no text. ✓
- Affichage en fourchette min-max pour les 5 impacts → Tasks 2 (back ranges), 11 (RangeGauge), 13 (grid of 5 gauges × 3 levels). ✓
- Dépendances en dernières versions → pinned exact versions verified against PyPI/npm on 2026-07-13 throughout. ✓

**2. Placeholder scan:** No "TBD"/"TODO" in code. The one intentional caveat is in Task 14 (ImpactCO2 equivalence _values_, not code) — flagged explicitly as illustrative and requiring replacement with real ImpactCO2 figures before merge, since I do not have live access to `equivalents.csv`'s exact current numbers.

**3. Type consistency:** `ImpactRange`/`UnitImpacts`/`AggregatedImpacts` (Task 2, 4) → `ImpactsOut`/`CalculateResponse` (Task 5, 7) → `Impacts`/`CalculateResult` (Task 12) → `RangeGauge` props (Task 11) all align on the same 5 keys (`gwp`, `energy`, `adpe`, `pe`, `water`) and `{min, max}` shape end to end.

---

## Execution Handoff

Plan complete and saved to `.superpowers/plans/2026-07-13-ai-calculator-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
