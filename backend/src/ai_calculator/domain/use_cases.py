"""Use-case catalogue: which providers, profiles and parameters a user can pick.

The catalogue is descriptive. Each profile carries how to compute the impacts
of one action (`TextCalculation`, `VideoCalculation`, `StaticCalculation`);
impacts are computed on demand by the scenario calculation, not stored here.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol

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

UseCaseKind = Literal["text", "video", "image"]
USE_CASE_KINDS: tuple[UseCaseKind, ...] = ("text", "video", "image")

ParameterValue = str | int | float | bool


class UseCasesConfigError(Exception):
    pass


class ParameterError(ValueError):
    """A parameter value the profile does not offer."""


@dataclass(frozen=True)
class CatalogProvider:
    id: str
    selected_by_default: bool


@dataclass(frozen=True)
class ProfileParameter:
    """A setting the user can change for a profile (e.g. video resolution)."""

    id: str
    options: list[ParameterValue]
    default: ParameterValue


class ProfileCalculation(Protocol):
    def unit_impacts(self, values: Mapping[str, ParameterValue]) -> UnitImpacts: ...


@dataclass(frozen=True)
class TextCalculation:
    """Text generation: EcoLogits LLM impacts for a fixed number of tokens."""

    ecologits_provider: str
    ecologits_model: str
    output_tokens: int

    def unit_impacts(self, values: Mapping[str, ParameterValue]) -> UnitImpacts:
        return compute_unit_impacts(
            provider=self.ecologits_provider,
            model_name=self.ecologits_model,
            output_tokens=self.output_tokens,
        )


@dataclass(frozen=True)
class VideoCalculation:
    """Video generation: EcoLogits video impacts for the chosen parameters."""

    model: str

    def unit_impacts(self, values: Mapping[str, ParameterValue]) -> UnitImpacts:
        return compute_video_unit_impacts(
            model_name=self.model,
            resolution=str(values["resolution"]),
            duration_s=float(values["duration_s"]),
            with_audio=bool(values["with_audio"]),
        )


@dataclass(frozen=True)
class StaticCalculation:
    """Fixed impacts declared in the catalogue (e.g. image generation)."""

    impacts: UnitImpacts

    def unit_impacts(self, values: Mapping[str, ParameterValue]) -> UnitImpacts:
        return self.impacts


def _same_value(option: ParameterValue, value: ParameterValue) -> bool:
    # In Python True == 1: a boolean only matches a boolean.
    if isinstance(option, bool) or isinstance(value, bool):
        return isinstance(option, bool) and isinstance(value, bool) and option == value
    return option == value


@dataclass(frozen=True)
class ResolvedProfile:
    id: str
    calculation: ProfileCalculation
    parameters: list[ProfileParameter] = field(default_factory=list)
    # Display names of the model(s) behind the profile, when known.
    models: list[str] = field(default_factory=list)
    # Generated tokens per action assumed for text profiles (None otherwise).
    output_tokens: int | None = None

    def resolve_values(
        self, chosen: Mapping[str, ParameterValue] | None = None
    ) -> dict[str, ParameterValue]:
        """Parameter values to compute with: the chosen ones, else the defaults.

        Raises ParameterError for an unknown parameter or an unsupported value.
        """
        chosen = dict(chosen or {})
        known = {p.id for p in self.parameters}
        unknown = sorted(set(chosen) - known)
        if unknown:
            raise ParameterError(f"unknown parameter(s): {', '.join(unknown)}")
        values: dict[str, ParameterValue] = {}
        for parameter in self.parameters:
            value = chosen.get(parameter.id, parameter.default)
            # Return the catalogue's own option (e.g. 8, not 8.0).
            option = next(
                (o for o in parameter.options if _same_value(o, value)), None
            )
            if option is None:
                raise ParameterError(
                    f"{parameter.id} {value!r} is not supported "
                    f"(supported: {parameter.options})"
                )
            values[parameter.id] = option
        return values

    def unit_impacts(
        self, chosen: Mapping[str, ParameterValue] | None = None
    ) -> UnitImpacts:
        """Impacts of one action with the chosen (or default) parameters."""
        return self.calculation.unit_impacts(self.resolve_values(chosen))


@dataclass(frozen=True)
class ResolvedProviderMapping:
    provider_id: str
    profiles: list[ResolvedProfile]


@dataclass(frozen=True)
class ResolvedUseCase:
    id: str
    kind: UseCaseKind
    subtitle_key: str
    default_provider: str
    recommended_tier: str
    providers: list[ResolvedProviderMapping]


@dataclass(frozen=True)
class Catalog:
    providers: list[CatalogProvider]
    use_cases: list[ResolvedUseCase]

    def find(
        self, use_case_id: str, provider_id: str, profile_id: str
    ) -> tuple[ResolvedUseCase, ResolvedProfile]:
        """Use case and profile for a selection; LookupError when unknown."""
        use_case = next((uc for uc in self.use_cases if uc.id == use_case_id), None)
        if use_case is None:
            raise LookupError(f"unknown use case '{use_case_id}'")
        mapping = next(
            (pm for pm in use_case.providers if pm.provider_id == provider_id), None
        )
        if mapping is None:
            raise LookupError(
                f"provider '{provider_id}' is not offered for use case '{use_case_id}'"
            )
        profile = next((p for p in mapping.profiles if p.id == profile_id), None)
        if profile is None:
            raise LookupError(
                f"profile '{profile_id}' is not offered by provider '{provider_id}' "
                f"for use case '{use_case_id}'"
            )
        return use_case, profile


def _require(mapping: dict, key: str, context: str) -> object:
    if key not in mapping:
        raise UseCasesConfigError(f"Missing required field '{key}' in {context}")
    return mapping[key]


def _parse_optional_range(mapping: dict, key: str, context: str) -> ImpactRange | None:
    value = _require(mapping, key, context)
    if value is None:
        return None
    return ImpactRange(min=float(_require(value, "min", context)), max=float(_require(value, "max", context)))


def _static_calculation(static_impacts: dict, context: str) -> StaticCalculation:
    return StaticCalculation(
        impacts=UnitImpacts(
            gwp=_parse_optional_range(static_impacts, "gwp", context),
            energy=_parse_optional_range(static_impacts, "energy", context),
            adpe=_parse_optional_range(static_impacts, "adpe", context),
            pe=_parse_optional_range(static_impacts, "pe", context),
            water=_parse_optional_range(static_impacts, "water", context),
        )
    )


def _text_calculation(profile: dict, context: str) -> TextCalculation:
    return TextCalculation(
        ecologits_provider=str(_require(profile, "ecologits_provider", context)),
        ecologits_model=str(_require(profile, "ecologits_model", context)),
        output_tokens=int(_require(profile, "output_tokens", context)),
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


_PROFILE_FIELD_BY_KIND: dict[UseCaseKind, str] = {
    "text": "ecologits_model",
    "video": "ecologits_video",
    "image": "static_impacts",
}


def _profile_kind(profile: dict) -> UseCaseKind:
    if "static_impacts" in profile:
        return "image"
    if "ecologits_video" in profile:
        return "video"
    return "text"


def _profile_model_id(profile: dict) -> str | None:
    if "static_impacts" in profile:
        return profile.get("model")
    if "ecologits_video" in profile:
        return profile["ecologits_video"].get("model")
    return profile.get("ecologits_model")


def _resolve_profile(
    profile: dict, kind: UseCaseKind, context: str, model_labels: dict[str, str]
) -> ResolvedProfile:
    profile_id = str(_require(profile, "id", context))
    profile_context = f"{context} profile '{profile_id}'"

    if _profile_kind(profile) != kind:
        raise UseCasesConfigError(
            f"{profile_context}: a '{kind}' use case needs "
            f"{_PROFILE_FIELD_BY_KIND[kind]} profiles"
        )

    model_id = _profile_model_id(profile)
    if model_id is not None and model_id not in model_labels:
        raise UseCasesConfigError(
            f"{profile_context}: model '{model_id}' has no display name in model_labels"
        )
    models = [str(model_labels[model_id])] if model_id is not None else []

    try:
        if kind == "image":
            resolved = ResolvedProfile(
                id=profile_id,
                calculation=_static_calculation(profile["static_impacts"], profile_context),
                models=models,
            )
        elif kind == "video":
            video = profile["ecologits_video"]
            model = str(_require(video, "model", profile_context))
            defaults = _require(video, "defaults", profile_context)
            parameters = _video_parameters(
                video_capabilities(model), defaults, profile_context
            )
            resolved = ResolvedProfile(
                id=profile_id,
                calculation=VideoCalculation(model=model),
                parameters=parameters,
                models=models,
            )
        else:
            calculation = _text_calculation(profile, profile_context)
            resolved = ResolvedProfile(
                id=profile_id,
                calculation=calculation,
                models=models,
                output_tokens=calculation.output_tokens,
            )
        # Validate the catalogue at startup: the default computation must work.
        resolved.unit_impacts()
    except (ModelNotFoundError, EcologitsComputationError) as exc:
        raise UseCasesConfigError(f"{profile_context}: {exc}") from exc
    return resolved


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
        use_case_context = f"use case '{use_case_id}'"
        kind = _require(uc, "kind", use_case_context)
        if kind not in USE_CASE_KINDS:
            raise UseCasesConfigError(
                f"{use_case_context}: kind must be one of {list(USE_CASE_KINDS)}, got {kind!r}"
            )
        default_provider = _require(uc, "default_provider", use_case_context)
        recommended_tier = _require(uc, "recommended_tier", use_case_context)
        raw_provider_mappings = _require(uc, "providers", use_case_context)
        provider_mappings = []
        for pm in raw_provider_mappings:
            provider_id = _require(pm, "provider_id", use_case_context)
            context = f"use case '{use_case_id}' provider '{provider_id}'"
            raw_profiles = _require(pm, "profiles", context)
            profiles = [
                _resolve_profile(p, kind, context, model_labels) for p in raw_profiles
            ]
            provider_mappings.append(
                ResolvedProviderMapping(provider_id=provider_id, profiles=profiles)
            )
        use_cases.append(
            ResolvedUseCase(
                id=use_case_id,
                kind=kind,
                subtitle_key=f"useCases.{use_case_id}.subtitle",
                default_provider=default_provider,
                recommended_tier=recommended_tier,
                providers=provider_mappings,
            )
        )

    return Catalog(providers=providers, use_cases=use_cases)
