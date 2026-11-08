from fastapi import APIRouter

from ai_calculator.domain.impacts import ImpactRange, UnitImpacts
from ai_calculator.domain.use_cases import Catalog, load_catalog
from ai_calculator.schemas.use_cases import (
    CatalogProviderOut,
    ImpactRangeOut,
    ImpactsOut,
    ProfileOut,
    ProviderMappingOut,
    UseCaseOut,
    UseCasesResponse,
)

router = APIRouter()

_catalog: Catalog = load_catalog()


def _to_range_out(range_: ImpactRange | None) -> ImpactRangeOut | None:
    if range_ is None:
        return None
    return ImpactRangeOut(min=range_.min, max=range_.max)


def _to_impacts_out(impacts: UnitImpacts) -> ImpactsOut:
    return ImpactsOut(
        gwp=_to_range_out(impacts.gwp),
        energy=_to_range_out(impacts.energy),
        adpe=_to_range_out(impacts.adpe),
        pe=_to_range_out(impacts.pe),
        water=_to_range_out(impacts.water),
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
                subtitle_key=uc.subtitle_key,
                default_provider=uc.default_provider,
                recommended_tier=uc.recommended_tier,
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
