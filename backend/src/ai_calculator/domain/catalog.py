from dataclasses import dataclass

from ecologits.model_repository import models as _ecologits_models


@dataclass(frozen=True)
class CatalogModel:
    provider: str
    name: str


def list_catalog_models() -> list[CatalogModel]:
    return [
        CatalogModel(provider=m.provider.value, name=m.name)
        for m in _ecologits_models.list_models()
    ]
