"""Methodological source behind each kind of use case, shown to users."""

from dataclasses import dataclass
from importlib.metadata import version


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
