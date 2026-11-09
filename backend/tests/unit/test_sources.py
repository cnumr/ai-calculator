import json
from importlib.metadata import version

from ai_calculator.domain.equivalents import DEFAULT_EQUIVALENTS_PATH
from ai_calculator.domain.sources import data_sources


def test_data_sources_name_ecologits_with_its_installed_version():
    ecologits = next(s for s in data_sources() if s.id == "ecologits")

    assert ecologits.name == "EcoLogits"
    assert ecologits.version == version("ecologits")
    assert ecologits.retrieved_on is None
    assert ecologits.url == "https://ecologits.ai/"


def test_data_sources_name_impactco2_with_its_retrieval_date():
    expected = json.loads(DEFAULT_EQUIVALENTS_PATH.read_text(encoding="utf-8"))["source"]

    impactco2 = next(s for s in data_sources() if s.id == "impactco2")

    assert impactco2.name == expected["name"]
    assert impactco2.version is None
    assert impactco2.retrieved_on == expected["retrievedOn"]
    assert impactco2.url == "https://impactco2.fr/"
