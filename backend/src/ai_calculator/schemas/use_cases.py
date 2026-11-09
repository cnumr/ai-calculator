from typing import Literal

from pydantic import BaseModel

# bool first: in smart mode Pydantic keeps exact types, so True stays a bool.
ParameterValueOut = bool | int | float | str


class ProfileParameterOut(BaseModel):
    """A choice among `options`, or a free integer (`options` null) in [min, max]."""

    id: str
    default: ParameterValueOut
    options: list[ParameterValueOut] | None
    min: int | None
    max: int | None


class ProfileOut(BaseModel):
    id: str
    parameters: list[ProfileParameterOut]
    models: list[str]


class ProviderMappingOut(BaseModel):
    provider_id: str
    profiles: list[ProfileOut]


class SourceOut(BaseModel):
    id: str
    version: str | None
    url: str | None


class UseCaseOut(BaseModel):
    id: str
    kind: Literal["text", "video", "image"]
    subtitle_key: str
    default_provider: str
    recommended_tier: str
    providers: list[ProviderMappingOut]
    source: SourceOut


class CatalogProviderOut(BaseModel):
    id: str
    selected_by_default: bool


class DataSourceOut(BaseModel):
    id: str
    name: str
    version: str | None
    retrieved_on: str | None
    url: str


class UseCasesResponse(BaseModel):
    providers: list[CatalogProviderOut]
    use_cases: list[UseCaseOut]
    # External data sources behind the calculations, with their version.
    data_sources: list[DataSourceOut]
