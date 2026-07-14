from fastapi import APIRouter

from ai_calculator.domain.use_cases import Catalog, load_catalog
from ai_calculator.schemas.use_cases import (
    CatalogProviderOut,
    ProfileOut,
    ProviderMappingOut,
    UseCaseOut,
    UseCasesResponse,
)

from .calculate import _to_impacts_out

router = APIRouter()

_catalog: Catalog = load_catalog()


def _to_use_cases_response(catalog: Catalog) -> UseCasesResponse:
    return UseCasesResponse(
        providers=[
            CatalogProviderOut(id=p.id, selected_by_default=p.selected_by_default)
            for p in catalog.providers
        ],
        use_cases=[
            UseCaseOut(
                id=uc.id,
                providers=[
                    ProviderMappingOut(
                        provider_id=pm.provider_id,
                        profiles=[
                            ProfileOut(id=p.id, impacts=_to_impacts_out(p.impacts))
                            for p in pm.profiles
                        ],
                    )
                    for pm in uc.providers
                ],
            )
            for uc in catalog.use_cases
        ],
    )


@router.get("/api/use-cases", response_model=UseCasesResponse)
def get_use_cases() -> UseCasesResponse:
    return _to_use_cases_response(_catalog)
