"""Methodological source behind each kind of use case, shown to users."""

from dataclasses import dataclass
from importlib.metadata import version

from ai_calculator.domain.equivalents import equivalents_source


@dataclass(frozen=True)
class MethodologicalSource:
    # Stable identifier; the frontend turns it into a localised sentence.
    id: str
    # Version of the model/library used, when there is one.
    version: str | None
    # Page describing the methodology, when there is one.
    url: str | None


_ECOLOGITS_DOCS = "https://ecologits.ai/latest/methodology"

_SOURCES_BY_KIND = {
    "text": ("ecologits_llm", f"{_ECOLOGITS_DOCS}/llm_inference/"),
    "video": ("ecologits_video", f"{_ECOLOGITS_DOCS}/video_generation/"),
}


def source_for_kind(kind: str) -> MethodologicalSource:
    """EcoLogits (installed version) for text and video; image values have
    no published source yet (taken from the POC V1)."""
    if kind not in _SOURCES_BY_KIND:
        return MethodologicalSource(id="unsourced", version=None, url=None)
    source_id, url = _SOURCES_BY_KIND[kind]
    return MethodologicalSource(id=source_id, version=version("ecologits"), url=url)


@dataclass(frozen=True)
class DataSource:
    """An external data source behind the calculations, shown in the footer."""

    id: str
    name: str
    # Version of a library, when the source is one (EcoLogits).
    version: str | None
    # Date the data was copied into the repository, for a dataset (ImpactCO2).
    retrieved_on: str | None
    url: str


def data_sources() -> list[DataSource]:
    """Sources used by the calculator, with the version or date in use.

    Read from what is actually installed or stored, so they never go stale.
    """
    impactco2 = equivalents_source()
    return [
        DataSource(
            id="ecologits",
            name="EcoLogits",
            version=version("ecologits"),
            retrieved_on=None,
            url="https://ecologits.ai/",
        ),
        DataSource(
            id="impactco2",
            name=impactco2["name"],
            version=None,
            retrieved_on=impactco2["retrievedOn"],
            url="https://impactco2.fr/",
        ),
    ]
