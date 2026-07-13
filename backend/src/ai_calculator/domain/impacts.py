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
