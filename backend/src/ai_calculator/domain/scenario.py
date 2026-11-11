"""Scenario calculation: usages → individual and enterprise annual impacts.

A usage's frequency is given per working day, week or month; it is
converted to an average per working day (see PERIODS_PER_YEAR), on which
the daily impacts are based.

This is the calculator's business logic (formerly computed by the frontend).
Rules kept identical to the previous frontend behaviour:

- totals start from zero and a missing (None) criterion counts as 0, so a
  total is never None;
- a provider's share is its `gwp.max` over the sum of `gwp.max`, providers
  listed in order of first appearance;
- CO2 equivalents are computed from the individual annual `gwp.max`.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Literal

from ai_calculator.domain.equivalents import Co2EquivalentQuantity, co2_equivalents
from ai_calculator.domain.impacts import ImpactRange, UnitImpacts
from ai_calculator.domain.use_cases import (
    Catalog,
    ParameterError,
    ParameterValue,
    UseCaseKind,
)

WORKING_DAYS_PER_YEAR = 218

FrequencyUnit = Literal["day", "week", "month"]

# Worked periods per year, consistent with the 218 working days: 5 working
# days a week (43.6 weeks), and 11 months (one month of leave).
PERIODS_PER_YEAR: dict[FrequencyUnit, float] = {
    "day": WORKING_DAYS_PER_YEAR,
    "week": WORKING_DAYS_PER_YEAR / 5,
    "month": 11,
}


def frequency_per_working_day(frequency: float, unit: FrequencyUnit) -> float:
    """Average actions per working day for `frequency` actions per `unit`."""
    return frequency * PERIODS_PER_YEAR[unit] / WORKING_DAYS_PER_YEAR

_CRITERIA = ("gwp", "energy", "adpe", "pe", "water")


class ScenarioError(ValueError):
    """An invalid scenario (unknown selection, unsupported parameter...)."""


@dataclass(frozen=True)
class UsageInput:
    kind: UseCaseKind
    use_case_id: str
    provider_id: str
    profile_id: str
    frequency: float
    frequency_unit: FrequencyUnit = "day"
    parameters: Mapping[str, ParameterValue] = field(default_factory=dict)


@dataclass(frozen=True)
class UsageResult:
    use_case_id: str
    provider_id: str
    profile_id: str
    frequency: float
    frequency_unit: FrequencyUnit
    # Equivalent per working day: the daily impacts follow it.
    frequency_per_day: float
    # Parameter values actually used (defaults filled in).
    parameters: dict[str, ParameterValue]
    unit_impacts: UnitImpacts
    daily_impacts: UnitImpacts
    annual_impacts: UnitImpacts


@dataclass(frozen=True)
class ProviderShare:
    provider_id: str
    annual_impacts: UnitImpacts
    gwp_share_percent: float


@dataclass(frozen=True)
class ScenarioResult:
    working_days_per_year: int
    usages: list[UsageResult]
    individual_annual: UnitImpacts
    enterprise_annual: UnitImpacts
    provider_breakdown: list[ProviderShare]
    co2_equivalents: list[Co2EquivalentQuantity]


def zero_impacts() -> UnitImpacts:
    zero = ImpactRange(min=0.0, max=0.0)
    return UnitImpacts(gwp=zero, energy=zero, adpe=zero, pe=zero, water=zero)


def scale_impacts(impacts: UnitImpacts, factor: float) -> UnitImpacts:
    def scale(value: ImpactRange | None) -> ImpactRange | None:
        if value is None:
            return None
        return ImpactRange(min=value.min * factor, max=value.max * factor)

    return UnitImpacts(**{c: scale(getattr(impacts, c)) for c in _CRITERIA})


def sum_impacts(a: UnitImpacts, b: UnitImpacts) -> UnitImpacts:
    def add(x: ImpactRange | None, y: ImpactRange | None) -> ImpactRange | None:
        if x is None and y is None:
            return None
        return ImpactRange(
            min=(x.min if x else 0.0) + (y.min if y else 0.0),
            max=(x.max if x else 0.0) + (y.max if y else 0.0),
        )

    return UnitImpacts(**{c: add(getattr(a, c), getattr(b, c)) for c in _CRITERIA})


def _gwp_max(impacts: UnitImpacts) -> float:
    return impacts.gwp.max if impacts.gwp else 0.0


def _compute_usage(catalog: Catalog, usage: UsageInput) -> UsageResult:
    context = (
        f"usage '{usage.use_case_id}' "
        f"(provider '{usage.provider_id}', profile '{usage.profile_id}')"
    )
    try:
        use_case, profile = catalog.find(
            usage.use_case_id, usage.provider_id, usage.profile_id
        )
    except LookupError as exc:
        raise ScenarioError(str(exc)) from exc
    if usage.kind != use_case.kind:
        raise ScenarioError(
            f"{context}: kind '{usage.kind}' does not match the use case kind "
            f"'{use_case.kind}'"
        )
    if usage.frequency < 0:
        raise ScenarioError(f"{context}: frequency must be positive")
    if usage.frequency_unit not in PERIODS_PER_YEAR:
        raise ScenarioError(f"{context}: unknown frequency unit '{usage.frequency_unit}'")
    try:
        values = profile.resolve_values(usage.parameters)
    except ParameterError as exc:
        raise ScenarioError(f"{context}: {exc}") from exc

    unit = profile.calculation.unit_impacts(values)
    per_day = frequency_per_working_day(usage.frequency, usage.frequency_unit)
    daily = scale_impacts(unit, per_day)
    return UsageResult(
        use_case_id=usage.use_case_id,
        provider_id=usage.provider_id,
        profile_id=usage.profile_id,
        frequency=usage.frequency,
        frequency_unit=usage.frequency_unit,
        frequency_per_day=per_day,
        parameters=values,
        unit_impacts=unit,
        daily_impacts=daily,
        annual_impacts=scale_impacts(daily, WORKING_DAYS_PER_YEAR),
    )


def _provider_breakdown(usages: Sequence[UsageResult]) -> list[ProviderShare]:
    totals: dict[str, UnitImpacts] = {}
    for usage in usages:
        totals[usage.provider_id] = sum_impacts(
            totals.get(usage.provider_id, zero_impacts()), usage.annual_impacts
        )
    gwp_total = sum(_gwp_max(impacts) for impacts in totals.values())
    return [
        ProviderShare(
            provider_id=provider_id,
            annual_impacts=impacts,
            gwp_share_percent=(
                0.0 if gwp_total == 0 else _gwp_max(impacts) / gwp_total * 100
            ),
        )
        for provider_id, impacts in totals.items()
    ]


def compute_scenario(
    catalog: Catalog, usages: Sequence[UsageInput], headcount: int
) -> ScenarioResult:
    if headcount < 1:
        raise ScenarioError("headcount must be at least 1")

    results = [_compute_usage(catalog, usage) for usage in usages]
    individual = zero_impacts()
    for result in results:
        individual = sum_impacts(individual, result.annual_impacts)

    return ScenarioResult(
        working_days_per_year=WORKING_DAYS_PER_YEAR,
        usages=results,
        individual_annual=individual,
        enterprise_annual=scale_impacts(individual, headcount),
        provider_breakdown=_provider_breakdown(results),
        co2_equivalents=co2_equivalents(_gwp_max(individual)),
    )
