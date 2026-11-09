from pydantic import BaseModel

from ai_calculator.domain.impacts import ImpactRange, UnitImpacts


class ImpactRangeOut(BaseModel):
    min: float
    max: float


class ImpactsOut(BaseModel):
    gwp: ImpactRangeOut | None
    energy: ImpactRangeOut | None
    adpe: ImpactRangeOut | None
    pe: ImpactRangeOut | None
    water: ImpactRangeOut | None


def _to_range_out(range_: ImpactRange | None) -> ImpactRangeOut | None:
    if range_ is None:
        return None
    return ImpactRangeOut(min=range_.min, max=range_.max)


def to_impacts_out(impacts: UnitImpacts) -> ImpactsOut:
    return ImpactsOut(
        gwp=_to_range_out(impacts.gwp),
        energy=_to_range_out(impacts.energy),
        adpe=_to_range_out(impacts.adpe),
        pe=_to_range_out(impacts.pe),
        water=_to_range_out(impacts.water),
    )
