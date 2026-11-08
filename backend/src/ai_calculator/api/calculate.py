from fastapi import APIRouter, HTTPException

from ai_calculator.api.catalog import CATALOG
from ai_calculator.domain.scenario import (
    ScenarioError,
    ScenarioResult,
    UsageInput,
    compute_scenario,
)
from ai_calculator.schemas.calculate import (
    CalculateRequest,
    CalculateResponse,
    Co2EquivalentOut,
    ProviderShareOut,
    UsageIn,
    UsageOut,
    VideoUsageIn,
)
from ai_calculator.schemas.impacts import to_impacts_out

router = APIRouter()


def _to_usage_input(usage: UsageIn) -> UsageInput:
    parameters = (
        usage.parameters.model_dump(exclude_none=True)
        if isinstance(usage, VideoUsageIn)
        else {}
    )
    return UsageInput(
        kind=usage.kind,
        use_case_id=usage.use_case_id,
        provider_id=usage.provider_id,
        profile_id=usage.profile_id,
        frequency_per_day=usage.frequency_per_day,
        parameters=parameters,
    )


def _to_response(result: ScenarioResult) -> CalculateResponse:
    return CalculateResponse(
        working_days_per_year=result.working_days_per_year,
        usages=[
            UsageOut(
                use_case_id=u.use_case_id,
                provider_id=u.provider_id,
                profile_id=u.profile_id,
                frequency_per_day=u.frequency_per_day,
                parameters=u.parameters,
                unit_impacts=to_impacts_out(u.unit_impacts),
                daily_impacts=to_impacts_out(u.daily_impacts),
                annual_impacts=to_impacts_out(u.annual_impacts),
            )
            for u in result.usages
        ],
        individual_annual=to_impacts_out(result.individual_annual),
        enterprise_annual=to_impacts_out(result.enterprise_annual),
        provider_breakdown=[
            ProviderShareOut(
                provider_id=s.provider_id,
                annual_impacts=to_impacts_out(s.annual_impacts),
                gwp_share_percent=s.gwp_share_percent,
            )
            for s in result.provider_breakdown
        ],
        co2_equivalents=[
            Co2EquivalentOut(id=e.id, impact_co2_slug=e.impact_co2_slug, quantity=e.quantity)
            for e in result.co2_equivalents
        ],
    )


@router.post("/api/calculate", response_model=CalculateResponse)
def calculate(request: CalculateRequest) -> CalculateResponse:
    """Impacts of a usage scenario: per usage, per person and per company, per year."""
    try:
        result = compute_scenario(
            CATALOG,
            [_to_usage_input(u) for u in request.usages],
            request.headcount,
        )
    except ScenarioError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _to_response(result)
