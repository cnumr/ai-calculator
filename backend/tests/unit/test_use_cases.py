import pytest

from ai_calculator.domain.use_cases import (
    Catalog,
    ParameterError,
    StaticCalculation,
    TextCalculation,
    UseCasesConfigError,
    VideoCalculation,
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
    kind: text
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
    kind: image
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

VIDEO_YAML = """
model_labels:
  google/veo-3.0: Veo 3
  google/veo-3.0-fast: Veo 3 Fast
providers:
  - id: google
    selected_by_default: true
use_cases:
  - id: video
    kind: video
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


def _load(tmp_path, text):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(text)
    return load_catalog(config_file)


def _load_video_profile(tmp_path, model="google/veo-3.0", resolution="720p", duration_s=8):
    catalog = _load(
        tmp_path,
        VIDEO_YAML.format(model=model, resolution=resolution, duration_s=duration_s),
    )
    return catalog.use_cases[0].providers[0].profiles[0]


# --- Catalogue structure -----------------------------------------------------


def test_load_catalog_reads_providers_and_use_case_kinds(tmp_path):
    catalog: Catalog = _load(tmp_path, VALID_YAML)

    assert [(p.id, p.selected_by_default) for p in catalog.providers] == [
        ("openai", True),
        ("google", False),
    ]
    assert [(uc.id, uc.kind) for uc in catalog.use_cases] == [
        ("email", "text"),
        ("image", "image"),
    ]


def test_load_catalog_gives_each_profile_its_calculation(tmp_path):
    email, image = _load(tmp_path, VALID_YAML).use_cases

    assert email.providers[0].profiles[0].calculation == TextCalculation(
        ecologits_provider="openai", ecologits_model="gpt-4o-mini"
    )
    assert isinstance(image.providers[0].profiles[0].calculation, StaticCalculation)


def test_load_catalog_exposes_model_names(tmp_path):
    email, image = _load(tmp_path, VALID_YAML).use_cases

    assert email.providers[0].profiles[0].models == ["GPT-4o mini"]
    assert image.providers[0].profiles[0].models == ["DALL·E 3"]


def test_load_catalog_gives_no_model_to_static_profiles_without_one(tmp_path):
    image = _load(tmp_path, VALID_YAML.replace("            model: dall-e-3\n", "")).use_cases[1]

    assert image.providers[0].profiles[0].models == []


def test_load_catalog_exposes_video_parameters_from_ecologits_capabilities(tmp_path):
    profile = _load_video_profile(tmp_path)

    assert profile.calculation == VideoCalculation(model="google/veo-3.0")
    assert profile.models == ["Veo 3"]
    assert [(p.id, p.options, p.default) for p in profile.parameters] == [
        ("resolution", ["720p", "1080p"], "720p"),
        ("duration_s", [5, 8, 10], 8),
        ("with_audio", [True, False], True),
    ]


def test_text_profiles_offer_their_output_tokens_as_a_free_integer(tmp_path):
    email, image = _load(tmp_path, VALID_YAML).use_cases

    [tokens] = email.providers[0].profiles[0].parameters
    assert (tokens.id, tokens.default, tokens.options) == ("output_tokens", 300, None)
    assert (tokens.minimum, tokens.maximum) == (1, 10_000_000)
    assert image.providers[0].profiles[0].parameters == []


# --- Unit impacts ------------------------------------------------------------


def test_text_profile_unit_impacts_come_from_ecologits(tmp_path):
    impacts = _load(tmp_path, VALID_YAML).use_cases[0].providers[0].profiles[0].unit_impacts()

    for range_ in (impacts.gwp, impacts.energy, impacts.adpe, impacts.pe, impacts.water):
        assert range_.max >= range_.min >= 0


def test_static_profile_unit_impacts_are_the_declared_values(tmp_path):
    impacts = _load(tmp_path, VALID_YAML).use_cases[1].providers[0].profiles[0].unit_impacts()

    assert (impacts.gwp.min, impacts.gwp.max) == (0.0125, 0.0125)
    assert impacts.energy is None
    assert impacts.water is None
    assert impacts.pe is None


def test_video_profile_unit_impacts_follow_the_parameters(tmp_path):
    profile = _load_video_profile(tmp_path)

    hd = profile.unit_impacts({"resolution": "720p"})
    full_hd = profile.unit_impacts({"resolution": "1080p"})

    assert full_hd.gwp.max > hd.gwp.max
    for range_ in (hd.gwp, hd.energy, hd.adpe, hd.pe, hd.water):
        assert range_.max >= range_.min > 0


def test_resolve_values_fills_in_defaults_and_returns_catalogue_options(tmp_path):
    profile = _load_video_profile(tmp_path)

    # 8.0 resolves to the catalogue's own option 8.
    assert profile.resolve_values({"duration_s": 8.0}) == {
        "resolution": "720p",
        "duration_s": 8,
        "with_audio": True,
    }


@pytest.mark.parametrize(
    "chosen",
    [
        {"resolution": "4k"},
        {"duration_s": 12},
        {"with_audio": 1},  # a boolean parameter only accepts booleans
        {"frame_rate": 30},
    ],
)
def test_resolve_values_rejects_unsupported_values(tmp_path, chosen):
    profile = _load_video_profile(tmp_path)

    with pytest.raises(ParameterError):
        profile.resolve_values(chosen)


def test_text_profile_impacts_follow_the_chosen_output_tokens(tmp_path):
    profile = _load(tmp_path, VALID_YAML).use_cases[0].providers[0].profiles[0]

    assert profile.resolve_values({}) == {"output_tokens": 300}
    assert profile.resolve_values({"output_tokens": 1000.0}) == {"output_tokens": 1000}
    assert (
        profile.unit_impacts({"output_tokens": 3000}).gwp.max
        > profile.unit_impacts().gwp.max
    )


@pytest.mark.parametrize(
    "chosen",
    [
        {"resolution": "720p"},
        {"output_tokens": 0},
        {"output_tokens": 10_000_001},
        {"output_tokens": 12.5},
        {"output_tokens": True},
        {"output_tokens": "300"},
    ],
)
def test_text_profiles_reject_invalid_parameters(tmp_path, chosen):
    profile = _load(tmp_path, VALID_YAML).use_cases[0].providers[0].profiles[0]

    with pytest.raises(ParameterError):
        profile.resolve_values(chosen)


# --- Catalogue lookup ----------------------------------------------------------


def test_catalog_find_returns_the_use_case_and_profile(tmp_path):
    catalog = _load(tmp_path, VALID_YAML)

    use_case, profile = catalog.find("email", "openai", "eco")

    assert (use_case.id, profile.id) == ("email", "eco")


@pytest.mark.parametrize(
    "selection",
    [("unknown", "openai", "eco"), ("email", "google", "eco"), ("email", "openai", "powerful")],
)
def test_catalog_find_raises_for_unknown_selections(tmp_path, selection):
    catalog = _load(tmp_path, VALID_YAML)

    with pytest.raises(LookupError):
        catalog.find(*selection)


# --- Validation at load ----------------------------------------------------------


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


def test_load_catalog_raises_on_unknown_ecologits_model(tmp_path):
    text = VALID_YAML.replace("gpt-4o-mini: GPT-4o mini", "does-not-exist: X").replace(
        "ecologits_model: gpt-4o-mini", "ecologits_model: does-not-exist"
    )

    with pytest.raises(UseCasesConfigError):
        _load(tmp_path, text)


def test_load_catalog_raises_on_model_without_display_name(tmp_path):
    with pytest.raises(UseCasesConfigError, match="gpt-4o-mini"):
        _load(tmp_path, VALID_YAML.replace("  gpt-4o-mini: GPT-4o mini\n", ""))


def test_load_catalog_raises_on_missing_kind(tmp_path):
    with pytest.raises(UseCasesConfigError, match="kind"):
        _load(tmp_path, VALID_YAML.replace("    kind: text\n", ""))


def test_load_catalog_raises_on_unknown_kind(tmp_path):
    with pytest.raises(UseCasesConfigError, match="kind"):
        _load(tmp_path, VALID_YAML.replace("kind: text", "kind: audio"))


def test_load_catalog_raises_when_profiles_do_not_match_the_kind(tmp_path):
    # A text use case declared as video: its profiles are LLM profiles.
    with pytest.raises(UseCasesConfigError, match="ecologits_video"):
        _load(tmp_path, VALID_YAML.replace("kind: text", "kind: video"))


def test_load_catalog_raises_on_missing_required_field(tmp_path):
    with pytest.raises(UseCasesConfigError):
        _load(tmp_path, VALID_YAML.replace("            output_tokens: 300\n", ""))


def test_load_catalog_raises_on_missing_file(tmp_path):
    with pytest.raises(UseCasesConfigError):
        load_catalog(tmp_path / "does-not-exist.yaml")


# --- Real configuration ----------------------------------------------------------


def test_real_config_loads():
    catalog = load_catalog()

    assert len(catalog.providers) == 5
    assert len(catalog.use_cases) == 8


def test_real_config_offers_google_and_openai_video_profiles():
    video = next(uc for uc in load_catalog().use_cases if uc.id == "video")

    profiles = {m.provider_id: [p.id for p in m.profiles] for m in video.providers}
    assert profiles == {"google": ["video", "video_fast"], "openai": ["video"]}
    for mapping in video.providers:
        for profile in mapping.profiles:
            assert {p.id for p in profile.parameters} == {
                "resolution",
                "duration_s",
                "with_audio",
            }


def test_real_config_names_the_model_of_every_profile():
    for use_case in load_catalog().use_cases:
        for mapping in use_case.providers:
            for profile in mapping.profiles:
                assert len(profile.models) == 1, (use_case.id, mapping.provider_id)


# --- Methodological source ---------------------------------------------------------


def test_use_cases_name_their_methodological_source(tmp_path):
    from importlib.metadata import version

    email, image = _load(tmp_path, VALID_YAML).use_cases
    video = _load(
        tmp_path, VIDEO_YAML.format(model="google/veo-3.0", resolution="720p", duration_s=8)
    ).use_cases[0]

    ecologits = version("ecologits")
    assert email.source.id == "ecologits_llm"
    assert email.source.version == ecologits
    assert email.source.url == "https://ecologits.ai/latest/methodology/llm_inference/"
    assert video.source.id == "ecologits_video"
    assert video.source.version == ecologits
    assert video.source.url == "https://ecologits.ai/latest/methodology/video_generation/"
    # Image values come from the POC V1, without a published source.
    assert image.source.id == "unsourced"
    assert image.source.version is None
    assert image.source.url is None
