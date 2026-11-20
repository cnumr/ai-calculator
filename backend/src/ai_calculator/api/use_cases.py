import hashlib
from functools import cache

from fastapi import APIRouter, Request, Response

from ai_calculator.api.catalog import CATALOG
from ai_calculator.domain.sources import data_sources
from ai_calculator.domain.use_cases import Catalog, ResolvedProfile
from ai_calculator.schemas.use_cases import (
    CatalogProviderOut,
    DataSourceOut,
    FamilyOut,
    ProfileOut,
    ProfileParameterOut,
    ProviderMappingOut,
    SourceOut,
    UseCaseOut,
    UseCasesResponse,
)

router = APIRouter()

# Cache HTTP du catalogue (écoconception, GreenIT RWEB_0021) : il ne change
# qu'au redéploiement, mais le front le demande à chaque visite.
# - Gardé 5 minutes par le navigateur sans requête : court, pour qu'un
#   redéploiement soit vite pris en compte.
# - Ensuite revalidé par son ETag : s'il n'a pas changé, la réponse est un
#   304 sans contenu.
CACHE_CONTROL = "public, max-age=300"


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
        families=[FamilyOut(id=family) for family in catalog.families],
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
                family=uc.family,
            )
            for uc in catalog.use_cases
        ],
        data_sources=[
            DataSourceOut(
                id=s.id,
                name=s.name,
                version=s.version,
                retrieved_on=s.retrieved_on,
                url=s.url,
            )
            for s in data_sources()
        ],
    )


@cache
def _catalog_body() -> tuple[bytes, str]:
    """Catalogue sérialisé une seule fois, et son ETag (empreinte du contenu)."""
    body = _to_use_cases_response(CATALOG).model_dump_json().encode()
    return body, f'"{hashlib.sha256(body).hexdigest()[:32]}"'


def _matches(if_none_match: str | None, etag: str) -> bool:
    """If-None-Match correspond-il à l'ETag ? Comparaison faible : nginx
    rend l'ETag faible (W/"...") quand il compresse la réponse."""
    if not if_none_match:
        return False
    candidates = [tag.strip().removeprefix("W/") for tag in if_none_match.split(",")]
    return "*" in candidates or etag in candidates


@router.get("/api/use-cases", response_model=UseCasesResponse)
def get_use_cases(request: Request) -> Response:
    """Catalogue of the choices a user can make (no impacts: see /api/calculate)."""
    body, etag = _catalog_body()
    headers = {"ETag": etag, "Cache-Control": CACHE_CONTROL}
    if _matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)
