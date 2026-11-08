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


# bool first: in smart mode Pydantic keeps exact types, so True stays a bool.
ParameterValueOut = bool | int | float | str


class ProfileParameterOut(BaseModel):
    id: str
    options: list[ParameterValueOut]
    default: ParameterValueOut


class ProfileVariantOut(BaseModel):
    values: dict[str, ParameterValueOut]
    impacts: ImpactsOut


class ProfileOut(BaseModel):
    id: str
    impacts: ImpactsOut
    parameters: list[ProfileParameterOut]
    variants: list[ProfileVariantOut]


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
