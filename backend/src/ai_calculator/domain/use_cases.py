"""Use-case catalogue: which providers, profiles and parameters a user can pick.

The catalogue is descriptive. Each profile carries how to compute the impacts
of one action (`TextCalculation`, `VideoCalculation`,
`ImageFromVideoCalculation`);
impacts are computed on demand by the scenario calculation, not stored here.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal, Protocol

import yaml

from ai_calculator.domain.impacts import (
    EcologitsComputationError,
    ModelNotFoundError,
    UnitImpacts,
    compute_unit_impacts,
    compute_video_unit_impacts,
    scale_impacts,
)
from ai_calculator.domain.sources import MethodologicalSource, source_for_kind
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


# Bounds of the generated tokens a user can set for a text action.
MIN_OUTPUT_TOKENS = 1
MAX_OUTPUT_TOKENS = 10_000_000


@dataclass(frozen=True)
class ProfileParameter:
    """A setting the user can change for a profile.

    Either a choice among `options` (e.g. video resolution), or, when
    `options` is None, a free integer between `minimum` and `maximum`
    (e.g. generated tokens).
    """

    id: str
    default: ParameterValue
    options: list[ParameterValue] | None = None
    minimum: int | None = None
    maximum: int | None = None

    def validate(self, value: ParameterValue) -> ParameterValue:
        """The value to compute with; ParameterError when it is not allowed."""
        if self.options is None:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or value != int(value):
                raise ParameterError(f"{self.id} must be an integer, got {value!r}")
            number = int(value)
            if (self.minimum is not None and number < self.minimum) or (
                self.maximum is not None and number > self.maximum
            ):
                raise ParameterError(
                    f"{self.id} {number} is out of range ({self.minimum}-{self.maximum})"
                )
            return number
        # Return the catalogue's own option (e.g. 8, not 8.0).
        option = next((o for o in self.options if _same_value(o, value)), None)
        if option is None:
            raise ParameterError(
                f"{self.id} {value!r} is not supported (supported: {self.options})"
            )
        return option


class ProfileCalculation(Protocol):
    def unit_impacts(self, values: Mapping[str, ParameterValue]) -> UnitImpacts: ...


@dataclass(frozen=True)
class TextCalculation:
    """Text generation: EcoLogits LLM impacts for the generated tokens."""

    ecologits_provider: str
    ecologits_model: str

    def unit_impacts(self, values: Mapping[str, ParameterValue]) -> UnitImpacts:
        return compute_unit_impacts(
            provider=self.ecologits_provider,
            model_name=self.ecologits_model,
            output_tokens=int(values["output_tokens"]),
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
class ImageFromVideoCalculation:
    """Image generation, transposed from a reference video (project methodology).

    EcoLogits does not model image generation. The methodology takes the
    impacts of a reference video clip computed by EcoLogits (Veo 3.1, 720p,
    8 s, with audio) and divides them by a factor per image size, derived from
    the energy per image measured in "The Hidden Cost of an Image"
    (arXiv 2506.17016). Every criterion is divided by the same factor.
    """

    video_model: str
    resolution: str
    duration_s: float
    with_audio: bool
    # (size, divisor) pairs, e.g. ("1024x1024", 30.0).
    divisors: tuple[tuple[str, float], ...]

    def unit_impacts(self, values: Mapping[str, ParameterValue]) -> UnitImpacts:
        divisor = dict(self.divisors)[str(values["size"])]
        video = compute_video_unit_impacts(
            model_name=self.video_model,
            resolution=self.resolution,
            duration_s=self.duration_s,
            with_audio=self.with_audio,
        )
        return scale_impacts(video, 1 / divisor)


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
        return {
            parameter.id: parameter.validate(chosen.get(parameter.id, parameter.default))
            for parameter in self.parameters
        }

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
    source: MethodologicalSource


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


def _text_calculation(profile: dict, context: str) -> TextCalculation:
    return TextCalculation(
        ecologits_provider=str(_require(profile, "ecologits_provider", context)),
        ecologits_model=str(_require(profile, "ecologits_model", context)),
    )


def _text_parameters(profile: dict, context: str) -> list[ProfileParameter]:
    # The catalogue's tokens per action are the default; users can change them.
    output_tokens = int(_require(profile, "output_tokens", context))
    if not MIN_OUTPUT_TOKENS <= output_tokens <= MAX_OUTPUT_TOKENS:
        raise UseCasesConfigError(f"{context}: output_tokens {output_tokens} is out of range")
    return [
        ProfileParameter(
            id="output_tokens",
            default=output_tokens,
            minimum=MIN_OUTPUT_TOKENS,
            maximum=MAX_OUTPUT_TOKENS,
        )
    ]


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
            ProfileParameter(id=parameter_id, default=default, options=list(options))
        )
    return parameters


def _image_from_video(
    spec: dict, context: str
) -> tuple[ImageFromVideoCalculation, list[ProfileParameter]]:
    """Calculation and size parameter of an image profile transposed from a
    reference video; the reference must be supported by the video model."""
    reference = _require(spec, "reference", context)
    model = str(_require(reference, "model", context))
    # Same checks as a video profile's defaults: the clip must be supported.
    _video_parameters(video_capabilities(model), reference, context)
    divisors = _require(spec, "size_divisors", context)
    if not isinstance(divisors, dict) or not divisors:
        raise UseCasesConfigError(f"{context}: size_divisors must map sizes to factors")
    if any(float(factor) <= 0 for factor in divisors.values()):
        raise UseCasesConfigError(f"{context}: size_divisors must be positive")
    default_size = _require(spec, "default_size", context)
    if default_size not in divisors:
        raise UseCasesConfigError(
            f"{context}: default_size {default_size!r} is not in size_divisors"
        )
    calculation = ImageFromVideoCalculation(
        video_model=model,
        resolution=str(reference["resolution"]),
        duration_s=float(reference["duration_s"]),
        with_audio=bool(reference["with_audio"]),
        divisors=tuple((str(size), float(factor)) for size, factor in divisors.items()),
    )
    parameters = [
        ProfileParameter(id="size", default=str(default_size), options=[str(s) for s in divisors])
    ]
    return calculation, parameters


_PROFILE_FIELD_BY_KIND: dict[UseCaseKind, str] = {
    "text": "ecologits_model",
    "video": "ecologits_video",
    "image": "image_from_video",
}


def _profile_kind(profile: dict) -> UseCaseKind:
    if "image_from_video" in profile:
        return "image"
    if "ecologits_video" in profile:
        return "video"
    return "text"


def _profile_model_id(profile: dict) -> str | None:
    if "image_from_video" in profile:
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
            calculation, parameters = _image_from_video(
                profile["image_from_video"], profile_context
            )
            resolved = ResolvedProfile(
                id=profile_id,
                calculation=calculation,
                parameters=parameters,
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
            resolved = ResolvedProfile(
                id=profile_id,
                calculation=_text_calculation(profile, profile_context),
                parameters=_text_parameters(profile, profile_context),
                models=models,
            )
        # Validate the catalogue at startup: the default computation must work.
        resolved.unit_impacts()
    except (ModelNotFoundError, EcologitsComputationError) as exc:
        raise UseCasesConfigError(f"{profile_context}: {exc}") from exc
    return resolved


def _parse_text_models(raw: dict, context: str) -> dict[str, list[dict]]:
    """The shared text-model table: provider -> its profiles, in order.

    Each profile maps a tier (eco, balanced, ...) to an EcoLogits model. Text
    use cases that declare `output_tokens` instead of `providers` offer every
    provider and profile of this table, so a model is changed in one place.
    """
    table = raw.get("text_models") or {}
    if not isinstance(table, dict):
        raise UseCasesConfigError(f"{context}: text_models must be a mapping")
    parsed: dict[str, list[dict]] = {}
    for provider_id, tiers in table.items():
        if not isinstance(tiers, dict) or not tiers:
            raise UseCasesConfigError(
                f"{context}: text_models.{provider_id} must map profiles to models"
            )
        parsed[provider_id] = [
            {
                "id": tier_id,
                "ecologits_provider": _require(
                    model, "ecologits_provider", f"text_models.{provider_id}.{tier_id}"
                ),
                "ecologits_model": _require(
                    model, "ecologits_model", f"text_models.{provider_id}.{tier_id}"
                ),
            }
            for tier_id, model in tiers.items()
        ]
    return parsed


def _text_provider_mappings(
    uc: dict, text_models: dict[str, list[dict]], context: str
) -> list[dict]:
    """Provider mappings of a text use case built from the shared table."""
    if not text_models:
        raise UseCasesConfigError(
            f"{context}: needs either 'providers' or a text_models table"
        )
    output_tokens = _require(uc, "output_tokens", context)
    return [
        {
            "provider_id": provider_id,
            "profiles": [
                {**profile, "output_tokens": output_tokens} for profile in profiles
            ],
        }
        for provider_id, profiles in text_models.items()
    ]


def _check_defaults(
    default_provider: str,
    recommended_tier: str,
    mappings: list[ResolvedProviderMapping],
    context: str,
) -> None:
    """The default provider must be offered, with the recommended profile."""
    mapping = next((m for m in mappings if m.provider_id == default_provider), None)
    if mapping is None:
        raise UseCasesConfigError(
            f"{context}: default_provider '{default_provider}' is not offered"
        )
    if all(p.id != recommended_tier for p in mapping.profiles):
        raise UseCasesConfigError(
            f"{context}: recommended_tier '{recommended_tier}' is not offered "
            f"by provider '{default_provider}'"
        )


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

    text_models = _parse_text_models(raw, str(config_path))

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
        if kind == "text" and "providers" not in uc:
            raw_provider_mappings = _text_provider_mappings(
                uc, text_models, use_case_context
            )
        else:
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
        _check_defaults(
            default_provider, recommended_tier, provider_mappings, use_case_context
        )
        use_cases.append(
            ResolvedUseCase(
                id=use_case_id,
                kind=kind,
                subtitle_key=f"useCases.{use_case_id}.subtitle",
                default_provider=default_provider,
                recommended_tier=recommended_tier,
                providers=provider_mappings,
                source=source_for_kind(kind),
            )
        )

    return Catalog(providers=providers, use_cases=use_cases)
