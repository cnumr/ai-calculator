from dataclasses import dataclass, field, replace
from itertools import product
from pathlib import Path

import yaml

from ai_calculator.domain.impacts import (
    EcologitsComputationError,
    ImpactRange,
    ModelNotFoundError,
    UnitImpacts,
    compute_unit_impacts,
    compute_video_unit_impacts,
)
from ai_calculator.domain.video import VideoCapabilities, video_capabilities

DEFAULT_USE_CASES_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "use_cases.yaml"
)


class UseCasesConfigError(Exception):
    pass


@dataclass(frozen=True)
class CatalogProvider:
    id: str
    selected_by_default: bool


ParameterValue = str | int | float | bool


@dataclass(frozen=True)
class ProfileParameter:
    """A setting the user can change for a profile (e.g. video resolution)."""

    id: str
    options: list[ParameterValue]
    default: ParameterValue


@dataclass(frozen=True)
class ProfileVariant:
    """Precomputed impacts for one combination of parameter values."""

    values: dict[str, ParameterValue]
    impacts: UnitImpacts


@dataclass(frozen=True)
class ResolvedProfile:
    id: str
    # Impacts of the default parameter values (or the only value when the
    # profile has no parameters).
    impacts: UnitImpacts
    parameters: list[ProfileParameter] = field(default_factory=list)
    variants: list[ProfileVariant] = field(default_factory=list)
    # Display names of the model(s) behind the profile, when known.
    models: list[str] = field(default_factory=list)
    # Generated tokens per action assumed for text profiles (None otherwise).
    output_tokens: int | None = None


@dataclass(frozen=True)
class ResolvedProviderMapping:
    provider_id: str
    profiles: list[ResolvedProfile]


@dataclass(frozen=True)
class ResolvedUseCase:
    id: str
    subtitle_key: str
    default_provider: str
    recommended_tier: str
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
    return ResolvedProfile(
        id=profile_id, impacts=impacts, output_tokens=int(output_tokens)
    )


def _video_parameters(
    capabilities: VideoCapabilities, defaults: dict, context: str
) -> list[ProfileParameter]:
    parameters = []
    for parameter_id, options in (
        ("resolution", capabilities.resolutions),
        ("duration_s", capabilities.durations_s),
        ("with_audio", capabilities.audio),
    ):
        default = _require(defaults, parameter_id, context)
        if default not in options:
            raise UseCasesConfigError(
                f"{context}: default {parameter_id} {default!r} is not supported "
                f"by the model (supported: {options})"
            )
        parameters.append(
            ProfileParameter(id=parameter_id, options=list(options), default=default)
        )
    return parameters


def _resolve_video_profile(profile_id: str, video: dict, context: str) -> ResolvedProfile:
    model = str(_require(video, "model", context))
    defaults = _require(video, "defaults", context)
    try:
        capabilities = video_capabilities(model)
        parameters = _video_parameters(capabilities, defaults, context)
        variants = []
        for combination in product(*(p.options for p in parameters)):
            values = {p.id: value for p, value in zip(parameters, combination)}
            impacts = compute_video_unit_impacts(
                model_name=model,
                resolution=str(values["resolution"]),
                duration_s=float(values["duration_s"]),
                with_audio=bool(values["with_audio"]),
            )
            variants.append(ProfileVariant(values=values, impacts=impacts))
    except (ModelNotFoundError, EcologitsComputationError) as exc:
        raise UseCasesConfigError(f"{context}: {exc}") from exc

    default_values = {p.id: p.default for p in parameters}
    default_impacts = next(v.impacts for v in variants if v.values == default_values)
    return ResolvedProfile(
        id=profile_id,
        impacts=default_impacts,
        parameters=parameters,
        variants=variants,
    )


def _profile_model_id(profile: dict) -> str | None:
    if "static_impacts" in profile:
        return profile.get("model")
    if "ecologits_video" in profile:
        return profile["ecologits_video"].get("model")
    return profile.get("ecologits_model")


def _resolve_profile_impacts(
    profile_id: str, profile: dict, context: str
) -> ResolvedProfile:
    if "static_impacts" in profile:
        return _resolve_static_profile(profile_id, profile["static_impacts"], context)
    if "ecologits_video" in profile:
        return _resolve_video_profile(profile_id, profile["ecologits_video"], context)
    return _resolve_llm_profile(profile_id, profile, context)


def _resolve_profile(
    profile: dict, context: str, model_labels: dict[str, str]
) -> ResolvedProfile:
    profile_id = _require(profile, "id", context)
    profile_context = f"{context} profile '{profile_id}'"
    model_id = _profile_model_id(profile)
    if model_id is not None and model_id not in model_labels:
        raise UseCasesConfigError(
            f"{profile_context}: model '{model_id}' has no display name in model_labels"
        )
    resolved = _resolve_profile_impacts(profile_id, profile, profile_context)
    models = [str(model_labels[model_id])] if model_id is not None else []
    return replace(resolved, models=models)


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

    model_labels = raw.get("model_labels") or {}
    if not isinstance(model_labels, dict):
        raise UseCasesConfigError(f"{config_path}: model_labels must be a mapping")

    raw_use_cases = _require(raw, "use_cases", str(config_path))
    use_cases = []
    for uc in raw_use_cases:
        use_case_id = _require(uc, "id", "use_cases entry")
        default_provider = _require(uc, "default_provider", f"use case '{use_case_id}'")
        recommended_tier = _require(uc, "recommended_tier", f"use case '{use_case_id}'")
        raw_provider_mappings = _require(uc, "providers", f"use case '{use_case_id}'")
        provider_mappings = []
        for pm in raw_provider_mappings:
            provider_id = _require(pm, "provider_id", f"use case '{use_case_id}'")
            raw_profiles = _require(pm, "profiles", f"use case '{use_case_id}' provider '{provider_id}'")
            context = f"use case '{use_case_id}' provider '{provider_id}'"
            profiles = [_resolve_profile(p, context, model_labels) for p in raw_profiles]
            provider_mappings.append(
                ResolvedProviderMapping(provider_id=provider_id, profiles=profiles)
            )
        use_cases.append(
            ResolvedUseCase(
                id=use_case_id,
                subtitle_key=f"useCases.{use_case_id}.subtitle",
                default_provider=default_provider,
                recommended_tier=recommended_tier,
                providers=provider_mappings,
            )
        )

    return Catalog(providers=providers, use_cases=use_cases)
