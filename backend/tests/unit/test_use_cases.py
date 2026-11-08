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
              energy: null
              water: null
              pe: null
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
    assert static_profile.impacts.energy is None
    assert static_profile.impacts.water is None
    assert static_profile.impacts.pe is None


def test_load_catalog_resolves_video_profiles_with_ecologits(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(
        """
providers:
  - id: google
    selected_by_default: true
use_cases:
  - id: video
    default_provider: google
    recommended_tier: video
    providers:
      - provider_id: google
        profiles:
          - id: video
            ecologits_video:
              model: google/veo-3.0
              resolution: 720p
              duration_s: 8
              with_audio: true
"""
    )

    catalog = load_catalog(config_file)

    profile = catalog.use_cases[0].providers[0].profiles[0]
    assert profile.id == "video"
    for range_ in (
        profile.impacts.gwp,
        profile.impacts.energy,
        profile.impacts.adpe,
        profile.impacts.pe,
        profile.impacts.water,
    ):
        assert range_ is not None
        assert range_.max >= range_.min > 0


def test_load_catalog_raises_on_unknown_video_model(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(
        """
providers:
  - id: google
    selected_by_default: true
use_cases:
  - id: video
    default_provider: google
    recommended_tier: video
    providers:
      - provider_id: google
        profiles:
          - id: video
            ecologits_video:
              model: google/veo-2
              resolution: 720p
              duration_s: 8
              with_audio: true
"""
    )

    with pytest.raises(UseCasesConfigError):
        load_catalog(config_file)


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


def test_real_config_computes_video_with_ecologits():
    catalog = load_catalog()

    video = next(uc for uc in catalog.use_cases if uc.id == "video")
    profile = video.providers[0].profiles[0]
    # Every criterion is available once video comes from EcoLogits.
    assert profile.impacts.energy is not None
    assert profile.impacts.water is not None
    assert profile.impacts.pe is not None
