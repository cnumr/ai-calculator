from pydantic import BaseModel, Field


class CalculateRequest(BaseModel):
    provider: str
    model: str
    output_tokens: int = Field(ge=1)
    requests_per_day: int = Field(gt=0)
    working_days_per_year: int = Field(default=220, gt=0)
    headcount: int = Field(default=1, gt=0)


class ImpactRangeOut(BaseModel):
    min: float
    max: float


class ImpactsOut(BaseModel):
    gwp: ImpactRangeOut
    energy: ImpactRangeOut
    adpe: ImpactRangeOut
    pe: ImpactRangeOut
    water: ImpactRangeOut


class CalculateResponse(BaseModel):
    unit: ImpactsOut
    individual_annual: ImpactsOut
    enterprise_annual: ImpactsOut
