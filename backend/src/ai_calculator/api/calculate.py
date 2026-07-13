from fastapi import APIRouter

from ai_calculator.domain.extrapolation import AggregatedImpacts, extrapolate
from ai_calculator.domain.impacts import UnitImpacts, compute_unit_impacts
from ai_calculator.schemas.calculate import (
    CalculateRequest,
    CalculateResponse,
    ImpactRangeOut,
    ImpactsOut,
)

router = APIRouter()


def _to_impacts_out(impacts: UnitImpacts | AggregatedImpacts) -> ImpactsOut:
    return ImpactsOut(
        gwp=ImpactRangeOut(min=impacts.gwp.min, max=impacts.gwp.max),
        energy=ImpactRangeOut(min=impacts.energy.min, max=impacts.energy.max),
        adpe=ImpactRangeOut(min=impacts.adpe.min, max=impacts.adpe.max),
        pe=ImpactRangeOut(min=impacts.pe.min, max=impacts.pe.max),
        water=ImpactRangeOut(min=impacts.water.min, max=impacts.water.max),
    )


@router.post("/api/calculate", response_model=CalculateResponse)
def calculate(payload: CalculateRequest) -> CalculateResponse:
    unit = compute_unit_impacts(
        provider=payload.provider,
        model_name=payload.model,
        output_tokens=payload.output_tokens,
    )
    individual_annual, enterprise_annual = extrapolate(
        unit,
        requests_per_day=payload.requests_per_day,
        working_days_per_year=payload.working_days_per_year,
        headcount=payload.headcount,
    )
    return CalculateResponse(
        unit=_to_impacts_out(unit),
        individual_annual=_to_impacts_out(individual_annual),
        enterprise_annual=_to_impacts_out(enterprise_annual),
    )
