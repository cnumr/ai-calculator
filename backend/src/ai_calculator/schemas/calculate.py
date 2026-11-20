"""Request and response of POST /api/calculate.

Usages form a union discriminated on `kind`: each use-case type declares the
parameters it accepts, so the OpenAPI schema documents them per type.
"""

from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from ai_calculator.domain.scenario import FrequencyUnit
from ai_calculator.domain.use_cases import MAX_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS
from ai_calculator.schemas.impacts import ImpactsOut
from ai_calculator.schemas.use_cases import ParameterValueOut

MAX_USAGES = 50


class _UsageIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    use_case_id: str
    provider_id: str
    profile_id: str
    frequency: float = Field(
        ge=0,
        # `frequency_per_day` is the former name, still accepted.
        validation_alias=AliasChoices("frequency", "frequency_per_day"),
        description="Average actions per `frequency_unit`.",
    )
    frequency_unit: FrequencyUnit = Field(
        default="day",
        description="Period of the frequency: working day, week (5 working days) "
        "or month (11 worked months a year).",
    )


class TextParametersIn(BaseModel):
    """Text settings; each one defaults to the profile's default value."""

    model_config = ConfigDict(extra="forbid")

    output_tokens: int | None = Field(
        default=None,
        ge=MIN_OUTPUT_TOKENS,
        le=MAX_OUTPUT_TOKENS,
        description="Tokens generated per action.",
        examples=[300],
    )


class TextUsageIn(_UsageIn):
    """Text generation (email, documents, assistant...)."""

    kind: Literal["text"]
    parameters: TextParametersIn = Field(default_factory=TextParametersIn)


class ImageParametersIn(BaseModel):
    """Image settings; each one defaults to the profile's default value."""

    model_config = ConfigDict(extra="forbid")

    size: str | None = Field(default=None, examples=["1024x1024"])


class ImageUsageIn(_UsageIn):
    """Image generation, transposed from a reference video per image size."""

    kind: Literal["image"]
    parameters: ImageParametersIn = Field(default_factory=ImageParametersIn)


class VideoParametersIn(BaseModel):
    """Video settings; each one defaults to the profile's default value."""

    model_config = ConfigDict(extra="forbid")

    resolution: str | None = Field(default=None, examples=["720p"])
    duration_s: float | None = Field(default=None, examples=[8])
    with_audio: bool | None = None


class VideoUsageIn(_UsageIn):
    """Video generation, with model-specific settings."""

    kind: Literal["video"]
    parameters: VideoParametersIn = Field(default_factory=VideoParametersIn)


UsageIn = Annotated[
    TextUsageIn | VideoUsageIn | ImageUsageIn, Field(discriminator="kind")
]


class CalculateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    usages: list[UsageIn] = Field(max_length=MAX_USAGES)
    headcount: int = Field(default=1, ge=1, le=10_000_000)


class UsageOut(BaseModel):
    use_case_id: str
    provider_id: str
    profile_id: str
    frequency: float
    frequency_unit: FrequencyUnit
    frequency_per_day: float = Field(description="Equivalent per working day.")
    parameters: dict[str, ParameterValueOut]
    unit_impacts: ImpactsOut
    daily_impacts: ImpactsOut
    annual_impacts: ImpactsOut


class ProviderShareOut(BaseModel):
    provider_id: str
    annual_impacts: ImpactsOut
    gwp_share_percent: float


class Co2EquivalentOut(BaseModel):
    id: str
    impact_co2_slug: str
    quantity: float


class CalculateResponse(BaseModel):
    working_days_per_year: int
    usages: list[UsageOut]
    individual_annual: ImpactsOut
    enterprise_annual: ImpactsOut
    provider_breakdown: list[ProviderShareOut]
    co2_equivalents: list[Co2EquivalentOut]
