"""CO2 equivalents (ImpactCO2, ADEME): make a GHG figure concrete.

Factors, source and update procedure live in data/co2_equivalents.json.
"""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

DEFAULT_EQUIVALENTS_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "co2_equivalents.json"
)


@dataclass(frozen=True)
class Co2Equivalent:
    id: str
    impact_co2_slug: str
    kg_co2eq_per_unit: float


@dataclass(frozen=True)
class Co2EquivalentQuantity:
    id: str
    impact_co2_slug: str
    # Raw quantity; rounding and plurals are presentation (frontend).
    quantity: float


@cache
def load_equivalents(path: Path = DEFAULT_EQUIVALENTS_PATH) -> tuple[Co2Equivalent, ...]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return tuple(
        Co2Equivalent(
            id=entry["id"],
            impact_co2_slug=entry["impactCo2Slug"],
            kg_co2eq_per_unit=float(entry["kgCo2eqPerUnit"]),
        )
        for entry in data["equivalents"]
    )


def co2_equivalents(gwp_kg_co2eq: float) -> list[Co2EquivalentQuantity]:
    """How many units of each equivalent emit `gwp_kg_co2eq`."""
    return [
        Co2EquivalentQuantity(
            id=eq.id,
            impact_co2_slug=eq.impact_co2_slug,
            quantity=gwp_kg_co2eq / eq.kg_co2eq_per_unit,
        )
        for eq in load_equivalents()
    ]
