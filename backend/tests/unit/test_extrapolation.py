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
