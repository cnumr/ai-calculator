from fastapi import APIRouter

from ai_calculator.domain.catalog import list_catalog_models
from ai_calculator.schemas.providers import ProviderModelOut

router = APIRouter()


@router.get("/api/providers", response_model=list[ProviderModelOut])
def get_providers() -> list[ProviderModelOut]:
    return [
        ProviderModelOut(provider=m.provider, name=m.name)
        for m in list_catalog_models()
    ]
