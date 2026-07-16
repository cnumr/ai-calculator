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


def _parse_optional_range(mapping: dict, key: str, context: str) -> ImpactRange | None:
    value = _require(mapping, key, context)
    if value is None:
        return None
    return ImpactRange(min=float(_require(value, "min", context)), max=float(_require(value, "max", context)))


def _resolve_static_profile(profile_id: str, static_impacts: dict, context: str) -> ResolvedProfile:
    impacts = UnitImpacts(
        gwp=_parse_optional_range(static_impacts, "gwp", context),
        energy=_parse_optional_range(static_impacts, "energy", context),
        adpe=_parse_optional_range(static_impacts, "adpe", context),
        pe=_parse_optional_range(static_impacts, "pe", context),
        water=_parse_optional_range(static_impacts, "water", context),
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
