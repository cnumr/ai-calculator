import pytest

from ai_calculator.domain.use_cases import (
    Catalog,
    UseCasesConfigError,
    load_catalog,
)

VALID_YAML = """
providers:
  - id: openai
    selected_by_default: true
  - id: google
    selected_by_default: false
use_cases:
  - id: email
    default_provider: openai
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: gpt-4o-mini
            output_tokens: 300
  - id: image
    default_provider: google
    recommended_tier: image
    providers:
      - provider_id: google
        profiles:
          - id: image
            static_impacts:
              gwp: {min: 0.0125, max: 0.0125}
              adpe: {min: 2.68e-07, max: 2.68e-07}
              energy: {min: 0.0, max: 0.0}
              water: {min: 0.0, max: 0.0}
              pe: {min: 0.0, max: 0.0}
"""


def test_load_catalog_resolves_llm_and_static_profiles(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(VALID_YAML)

    catalog: Catalog = load_catalog(config_file)

    assert [p.id for p in catalog.providers] == ["openai", "google"]
    assert catalog.providers[0].selected_by_default is True
    assert catalog.providers[1].selected_by_default is False

    email = next(uc for uc in catalog.use_cases if uc.id == "email")
    email_openai = next(p for p in email.providers if p.provider_id == "openai")
    eco_profile = next(p for p in email_openai.profiles if p.id == "eco")
    assert eco_profile.impacts.gwp.max >= eco_profile.impacts.gwp.min >= 0

    image = next(uc for uc in catalog.use_cases if uc.id == "image")
    image_google = next(p for p in image.providers if p.provider_id == "google")
    static_profile = next(p for p in image_google.profiles if p.id == "image")
    assert static_profile.impacts.gwp.min == 0.0125
    assert static_profile.impacts.gwp.max == 0.0125
    assert static_profile.impacts.energy.min == 0.0
    assert static_profile.impacts.energy.max == 0.0


def test_load_catalog_raises_on_unknown_ecologits_model(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(
        """
providers:
  - id: openai
    selected_by_default: true
use_cases:
  - id: email
    default_provider: openai
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
            ecologits_model: does-not-exist
            output_tokens: 300
"""
    )

    with pytest.raises(UseCasesConfigError):
        load_catalog(config_file)


def test_load_catalog_raises_on_missing_required_field(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(
        """
providers:
  - id: openai
    selected_by_default: true
use_cases:
  - id: email
    default_provider: openai
    recommended_tier: eco
    providers:
      - provider_id: openai
        profiles:
          - id: eco
            ecologits_provider: openai
"""
    )

    with pytest.raises(UseCasesConfigError):
        load_catalog(config_file)


def test_load_catalog_raises_on_missing_file(tmp_path):
    with pytest.raises(UseCasesConfigError):
        load_catalog(tmp_path / "does-not-exist.yaml")


def test_load_catalog_default_path_loads_real_config():
    catalog = load_catalog()

    assert len(catalog.providers) == 5
    assert len(catalog.use_cases) == 8
