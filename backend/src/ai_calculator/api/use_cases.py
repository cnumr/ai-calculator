from fastapi import APIRouter

from ai_calculator.api.catalog import CATALOG
from ai_calculator.domain.use_cases import Catalog, ResolvedProfile
from ai_calculator.schemas.use_cases import (
    CatalogProviderOut,
    ProfileOut,
    ProfileParameterOut,
    ProviderMappingOut,
    SourceOut,
    UseCaseOut,
    UseCasesResponse,
)

router = APIRouter()


def _to_profile_out(profile: ResolvedProfile) -> ProfileOut:
    return ProfileOut(
        id=profile.id,
        parameters=[
            ProfileParameterOut(
                id=p.id, default=p.default, options=p.options, min=p.minimum, max=p.maximum
            )
            for p in profile.parameters
        ],
        models=profile.models,
    )


def _to_use_cases_response(catalog: Catalog) -> UseCasesResponse:
    return UseCasesResponse(
        providers=[
            CatalogProviderOut(id=p.id, selected_by_default=p.selected_by_default)
            for p in catalog.providers
        ],
        use_cases=[
            UseCaseOut(
                id=uc.id,
                kind=uc.kind,
                subtitle_key=uc.subtitle_key,
                default_provider=uc.default_provider,
                recommended_tier=uc.recommended_tier,
                providers=[
                    ProviderMappingOut(
                        provider_id=pm.provider_id,
                        profiles=[_to_profile_out(p) for p in pm.profiles],
                    )
                    for pm in uc.providers
                ],
                source=SourceOut(
                    id=uc.source.id, version=uc.source.version, url=uc.source.url
                ),
            )
            for uc in catalog.use_cases
        ],
    )


@router.get("/api/use-cases", response_model=UseCasesResponse)
def get_use_cases() -> UseCasesResponse:
    """Catalogue of the choices a user can make (no impacts: see /api/calculate)."""
    return _to_use_cases_response(CATALOG)
