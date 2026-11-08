from dataclasses import dataclass

from ecologits.estimations.video import video_impacts
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
    gwp: ImpactRange | None
    energy: ImpactRange | None
    adpe: ImpactRange | None
    pe: ImpactRange | None
    water: ImpactRange | None


def _to_range(value: float | RangeValue) -> ImpactRange:
    if isinstance(value, RangeValue):
        return ImpactRange(min=float(value.min), max=float(value.max))
    return ImpactRange(min=float(value), max=float(value))


def _to_unit_impacts(result: ImpactsOutput, provider: str, model_name: str) -> UnitImpacts:
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


def compute_unit_impacts(
    provider: str, model_name: str, output_tokens: int
) -> UnitImpacts:
    result: ImpactsOutput = llm_impacts(
        provider=provider,
        model_name=model_name,
        output_token_count=output_tokens,
        request_latency=float("inf"),
    )
    return _to_unit_impacts(result, provider, model_name)


def compute_video_unit_impacts(
    model_name: str, resolution: str, duration_s: float, with_audio: bool
) -> UnitImpacts:
    """Impacts of generating one video with an EcoLogits video model.

    `model_name` is the EcoLogits video model id (e.g. "google/veo-3.0").
    The datacenter (location, PUE, WUE) is the model provider's EcoLogits
    configuration, as for text generation.
    """
    result: ImpactsOutput = video_impacts(
        model_name=model_name,
        resolution=resolution,
        duration=duration_s,
        with_audio=with_audio,
        datacenter_location=None,
    )
    provider = model_name.split("/", 1)[0]
    return _to_unit_impacts(result, provider, model_name)
