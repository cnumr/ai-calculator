from pydantic import BaseModel


class ImpactRangeOut(BaseModel):
    min: float
    max: float


class ImpactsOut(BaseModel):
    gwp: ImpactRangeOut | None
    energy: ImpactRangeOut | None
    adpe: ImpactRangeOut | None
    pe: ImpactRangeOut | None
    water: ImpactRangeOut | None


class ProfileOut(BaseModel):
    id: str
    impacts: ImpactsOut


class ProviderMappingOut(BaseModel):
    provider_id: str
    profiles: list[ProfileOut]


class UseCaseOut(BaseModel):
    id: str
    subtitle_key: str
    default_provider: str
    recommended_tier: str
    providers: list[ProviderMappingOut]


class CatalogProviderOut(BaseModel):
    id: str
    selected_by_default: bool


class UseCasesResponse(BaseModel):
    providers: list[CatalogProviderOut]
    use_cases: list[UseCaseOut]
