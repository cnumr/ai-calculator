import pytest

from ai_calculator.domain.use_cases import (
    Catalog,
    UseCasesConfigError,
    load_catalog,
)

VALID_YAML = """
model_labels:
  gpt-4o-mini: GPT-4o mini
  dall-e-3: DALL·E 3
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
            model: dall-e-3
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


VIDEO_YAML = """
model_labels:
  google/veo-3.0: Veo 3
  google/veo-3.0-fast: Veo 3 Fast
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
              model: {model}
              defaults:
                resolution: {resolution}
                duration_s: {duration_s}
                with_audio: true
"""


def _load_video_profile(tmp_path, model="google/veo-3.0", resolution="720p", duration_s=8):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(
        VIDEO_YAML.format(model=model, resolution=resolution, duration_s=duration_s)
    )
    return load_catalog(config_file).use_cases[0].providers[0].profiles[0]


def test_load_catalog_exposes_video_parameters_from_ecologits_capabilities(tmp_path):
    profile = _load_video_profile(tmp_path)

    assert [(p.id, p.options, p.default) for p in profile.parameters] == [
        ("resolution", ["720p", "1080p"], "720p"),
        ("duration_s", [5, 8, 10], 8),
        ("with_audio", [True, False], True),
    ]


def test_load_catalog_precomputes_one_variant_per_combination(tmp_path):
    profile = _load_video_profile(tmp_path)

    assert len(profile.variants) == 2 * 3 * 2
    for variant in profile.variants:
        for range_ in (
            variant.impacts.gwp,
            variant.impacts.energy,
            variant.impacts.adpe,
            variant.impacts.pe,
            variant.impacts.water,
        ):
            assert range_ is not None
            assert range_.max >= range_.min > 0


def test_load_catalog_uses_the_default_variant_as_profile_impacts(tmp_path):
    profile = _load_video_profile(tmp_path)

    default = next(
        v
        for v in profile.variants
        if v.values == {"resolution": "720p", "duration_s": 8, "with_audio": True}
    )
    assert profile.impacts == default.impacts


def test_load_catalog_video_impacts_grow_with_resolution(tmp_path):
    profile = _load_video_profile(tmp_path)

    def gwp_max(resolution):
        return next(
            v.impacts.gwp.max
            for v in profile.variants
            if v.values == {"resolution": resolution, "duration_s": 8, "with_audio": True}
        )

    assert gwp_max("1080p") > gwp_max("720p")


def test_load_catalog_raises_on_unsupported_default_duration(tmp_path):
    # veo-3.0-fast only offers 4, 6 or 8 s.
    with pytest.raises(UseCasesConfigError, match="duration_s"):
        _load_video_profile(tmp_path, model="google/veo-3.0-fast", duration_s=10)


def test_load_catalog_raises_on_unsupported_default_resolution(tmp_path):
    with pytest.raises(UseCasesConfigError, match="resolution"):
        _load_video_profile(tmp_path, resolution="4k")


def test_load_catalog_raises_on_unknown_video_model(tmp_path):
    with pytest.raises(UseCasesConfigError):
        _load_video_profile(tmp_path, model="google/veo-2")


def test_load_catalog_gives_text_profiles_no_parameters(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(VALID_YAML)

    for use_case in load_catalog(config_file).use_cases:
        for mapping in use_case.providers:
            for profile in mapping.profiles:
                assert profile.parameters == []
                assert profile.variants == []


def test_load_catalog_exposes_the_display_name_of_each_profile_model(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(VALID_YAML)

    catalog = load_catalog(config_file)

    email, image = catalog.use_cases
    assert email.providers[0].profiles[0].models == ["GPT-4o mini"]
    assert image.providers[0].profiles[0].models == ["DALL·E 3"]


def test_load_catalog_exposes_output_tokens_of_text_profiles_only(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(VALID_YAML)

    email, image = load_catalog(config_file).use_cases
    assert email.providers[0].profiles[0].output_tokens == 300
    assert image.providers[0].profiles[0].output_tokens is None


def test_load_catalog_exposes_the_video_model_display_name(tmp_path):
    profile = _load_video_profile(tmp_path)

    assert profile.models == ["Veo 3"]


def test_load_catalog_gives_no_model_to_static_profiles_without_one(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(VALID_YAML.replace("            model: dall-e-3\n", ""))

    image = load_catalog(config_file).use_cases[1]
    assert image.providers[0].profiles[0].models == []


def test_load_catalog_raises_on_model_without_display_name(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(VALID_YAML.replace("  gpt-4o-mini: GPT-4o mini\n", ""))

    with pytest.raises(UseCasesConfigError, match="gpt-4o-mini"):
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


def test_real_config_offers_google_and_openai_video_profiles():
    catalog = load_catalog()

    video = next(uc for uc in catalog.use_cases if uc.id == "video")
    profiles = {
        mapping.provider_id: [p.id for p in mapping.profiles]
        for mapping in video.providers
    }
    assert profiles == {"google": ["video", "video_fast"], "openai": ["video"]}
    for mapping in video.providers:
        for profile in mapping.profiles:
            assert {p.id for p in profile.parameters} == {
                "resolution",
                "duration_s",
                "with_audio",
            }
            assert profile.impacts.energy is not None


def test_real_config_names_the_model_of_every_profile():
    catalog = load_catalog()

    for use_case in catalog.use_cases:
        for mapping in use_case.providers:
            for profile in mapping.profiles:
                assert len(profile.models) == 1, (use_case.id, mapping.provider_id)
