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
