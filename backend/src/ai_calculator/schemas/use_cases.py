from pydantic import BaseModel

from .calculate import ImpactsOut


class ProfileOut(BaseModel):
    id: str
    impacts: ImpactsOut


class ProviderMappingOut(BaseModel):
    provider_id: str
    profiles: list[ProfileOut]


class UseCaseOut(BaseModel):
    id: str
    providers: list[ProviderMappingOut]


class CatalogProviderOut(BaseModel):
    id: str
    selected_by_default: bool


class UseCasesResponse(BaseModel):
    providers: list[CatalogProviderOut]
    use_cases: list[UseCaseOut]
