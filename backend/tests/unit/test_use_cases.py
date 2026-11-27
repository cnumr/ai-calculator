import pytest

from ai_calculator.domain.use_cases import (
    Catalog,
    ParameterError,
    ImageFromVideoCalculation,
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
            image_from_video:
              reference:
                model: google/veo-3.1
                resolution: 720p
                duration_s: 8
                with_audio: true
              size_divisors:
                1024x1024: 30
              default_size: 1024x1024
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
    assert isinstance(image.providers[0].profiles[0].calculation, ImageFromVideoCalculation)


def test_load_catalog_exposes_model_names(tmp_path):
    email, image = _load(tmp_path, VALID_YAML).use_cases

    assert email.providers[0].profiles[0].models == ["GPT-4o mini"]
    assert image.providers[0].profiles[0].models == ["DALL·E 3"]


def test_load_catalog_gives_no_model_to_image_profiles_without_one(tmp_path):
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
    assert [p.id for p in image.providers[0].profiles[0].parameters] == ["size"]


# --- Unit impacts ------------------------------------------------------------


def test_text_profile_unit_impacts_come_from_ecologits(tmp_path):
    impacts = _load(tmp_path, VALID_YAML).use_cases[0].providers[0].profiles[0].unit_impacts()

    for range_ in (impacts.gwp, impacts.energy, impacts.adpe, impacts.pe, impacts.water):
        assert range_.max >= range_.min >= 0


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
    assert len(catalog.use_cases) == 12


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
    # Images are transposed from an EcoLogits video (methodology page).
    assert image.source.id == "image_from_video"
    assert image.source.version == ecologits
    assert image.source.url == "/methodologie#images"


# --- Shared text-model table ---------------------------------------------------------

TEXT_MODELS_YAML = """
model_labels:
  gpt-4o-mini: GPT-4o mini
  gpt-4o: GPT-4o
  claude-haiku-4-5: Claude Haiku 4.5
providers:
  - id: openai
    selected_by_default: true
  - id: anthropic
    selected_by_default: false
text_models:
  openai:
    eco: {ecologits_provider: openai, ecologits_model: gpt-4o-mini}
    balanced: {ecologits_provider: openai, ecologits_model: gpt-4o}
  anthropic:
    eco: {ecologits_provider: anthropic, ecologits_model: claude-haiku-4-5}
use_cases:
  - id: email
    kind: text
    default_provider: openai
    recommended_tier: balanced
    output_tokens: 300
"""


def test_text_use_cases_without_providers_offer_every_model_of_the_shared_table(tmp_path):
    email = _load(tmp_path, TEXT_MODELS_YAML).use_cases[0]

    offered = {
        m.provider_id: [(p.id, p.calculation.ecologits_model) for p in m.profiles]
        for m in email.providers
    }
    assert offered == {
        "openai": [("eco", "gpt-4o-mini"), ("balanced", "gpt-4o")],
        "anthropic": [("eco", "claude-haiku-4-5")],
    }
    for mapping in email.providers:
        for profile in mapping.profiles:
            assert profile.parameters[0].id == "output_tokens"
            assert profile.parameters[0].default == 300


def test_text_use_case_without_providers_needs_the_shared_table(tmp_path):
    yaml_text = TEXT_MODELS_YAML.split("text_models:")[0] + "use_cases:" + (
        TEXT_MODELS_YAML.split("use_cases:")[1]
    )
    with pytest.raises(UseCasesConfigError, match="text_models"):
        _load(tmp_path, yaml_text)


def test_load_catalog_raises_when_the_default_provider_is_not_offered(tmp_path):
    with pytest.raises(UseCasesConfigError, match="default_provider 'mistral'"):
        _load(tmp_path, TEXT_MODELS_YAML.replace("default_provider: openai", "default_provider: mistral"))


def test_load_catalog_raises_when_the_recommended_tier_is_not_offered(tmp_path):
    with pytest.raises(UseCasesConfigError, match="recommended_tier 'powerful'"):
        _load(tmp_path, TEXT_MODELS_YAML.replace("recommended_tier: balanced", "recommended_tier: powerful"))


def test_real_config_offers_the_methodology_use_cases_with_the_balanced_profile():
    catalog = load_catalog()
    by_id = {uc.id: uc for uc in catalog.use_cases}

    expected_tokens = {"slides": 2000, "spreadsheet": 2500, "email_long": 1000, "dev_assistance": 100000}
    for use_case_id, tokens in expected_tokens.items():
        use_case = by_id[use_case_id]
        assert use_case.kind == "text"
        assert use_case.recommended_tier == "balanced"
        assert {m.provider_id for m in use_case.providers} == {
            "openai", "anthropic", "mistral", "google", "microsoft_copilot"
        }
        profile = next(
            p
            for m in use_case.providers
            if m.provider_id == use_case.default_provider
            for p in m.profiles
            if p.id == "balanced"
        )
        assert profile.parameters[0].default == tokens


def test_real_config_uses_one_model_per_provider_and_profile_for_every_text_use_case():
    models: dict[tuple[str, str], set[str]] = {}
    for use_case in load_catalog().use_cases:
        if use_case.kind != "text":
            continue
        for mapping in use_case.providers:
            for profile in mapping.profiles:
                key = (mapping.provider_id, profile.id)
                models.setdefault(key, set()).add(profile.calculation.ecologits_model)
    assert all(len(names) == 1 for names in models.values()), models


def test_real_config_video_follows_the_methodology_reference_veo_3_1():
    video = next(uc for uc in load_catalog().use_cases if uc.id == "video")
    google = next(m for m in video.providers if m.provider_id == "google")
    models = {p.id: p.calculation.model for p in google.profiles}
    assert models == {"video": "google/veo-3.1", "video_fast": "google/veo-3.1-fast"}

    standard = next(p for p in google.profiles if p.id == "video")
    options = {p.id: p.options for p in standard.parameters}
    assert options["resolution"] == ["720p", "1080p"]
    assert options["duration_s"] == [4, 6, 8]
    # Methodology reference: Veo 3.1, 720p, 8 s, with audio, 27.7 to 60.6 Wh.
    energy = standard.unit_impacts().energy
    assert (round(energy.min * 1000, 1), round(energy.max * 1000, 1)) == (27.7, 60.6)


# --- Images transposed from a reference video ---------------------------------------

IMAGE_FROM_VIDEO_YAML = """
model_labels:
  gemini-2.5-flash-image: Gemini 2.5 Flash Image
providers:
  - id: google
    selected_by_default: true
use_cases:
  - id: image
    kind: image
    default_provider: google
    recommended_tier: image
    providers:
      - provider_id: google
        profiles:
          - id: image
            model: gemini-2.5-flash-image
            image_from_video:
              reference:
                model: google/veo-3.1
                resolution: {resolution}
                duration_s: 8
                with_audio: true
              size_divisors:
                1024x1024: 30
                2048x2048: {large_divisor}
              default_size: {default_size}
"""


def _load_image(tmp_path, resolution="720p", large_divisor=8, default_size="1024x1024"):
    return _load(
        tmp_path,
        IMAGE_FROM_VIDEO_YAML.format(
            resolution=resolution, large_divisor=large_divisor, default_size=default_size
        ),
    ).use_cases[0]


def test_image_profiles_offer_their_sizes_and_divide_the_reference_video(tmp_path):
    from ai_calculator.domain.impacts import compute_video_unit_impacts

    image = _load_image(tmp_path)
    profile = image.providers[0].profiles[0]
    clip = compute_video_unit_impacts("google/veo-3.1", "720p", 8, True)

    assert [(p.id, p.default, p.options) for p in profile.parameters] == [
        ("size", "1024x1024", ["1024x1024", "2048x2048"])
    ]
    small = profile.unit_impacts()
    large = profile.unit_impacts({"size": "2048x2048"})
    for criterion in ("gwp", "energy", "adpe", "pe", "water"):
        assert getattr(small, criterion).max == pytest.approx(getattr(clip, criterion).max / 30)
        assert getattr(large, criterion).min == pytest.approx(getattr(clip, criterion).min / 8)
    assert image.source.id == "image_from_video"
    assert image.source.url == "/methodologie#images"


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"resolution": "4k"}, "resolution"),
        ({"large_divisor": 0}, "positive"),
        ({"default_size": "512x512"}, "default_size"),
    ],
)
def test_load_catalog_raises_on_invalid_image_transposition(tmp_path, override, message):
    with pytest.raises(UseCasesConfigError, match=message):
        _load_image(tmp_path, **override)


def test_real_config_images_follow_the_methodology():
    image = next(uc for uc in load_catalog().use_cases if uc.id == "image")

    assert {m.provider_id for m in image.providers} == {"google", "openai"}
    for mapping in image.providers:
        profile = mapping.profiles[0]
        # About 1.5 Wh per 1024x1024 image and 5 Wh per 2048x2048 image.
        small = profile.unit_impacts({"size": "1024x1024"}).energy
        large = profile.unit_impacts({"size": "2048x2048"}).energy
        assert (small.min + small.max) / 2 * 1000 == pytest.approx(1.47, abs=0.01)
        assert (large.min + large.max) / 2 * 1000 == pytest.approx(5.52, abs=0.01)


# --- Families ---------------------------------------------------------------------

def _with_families(text, family="writing"):
    return text.replace(
        "use_cases:\n", "families:\n  - id: writing\n  - id: visual\nuse_cases:\n", 1
    ).replace("    kind: text\n", f"    family: {family}\n    kind: text\n", 1)


def test_load_catalog_reads_families_and_the_family_of_each_use_case(tmp_path):
    catalog = _load(tmp_path, _with_families(TEXT_MODELS_YAML))

    assert catalog.families == ["writing", "visual"]
    assert catalog.use_cases[0].family == "writing"


def test_families_are_optional(tmp_path):
    catalog = _load(tmp_path, TEXT_MODELS_YAML)

    assert catalog.families == []
    assert catalog.use_cases[0].family is None


@pytest.mark.parametrize(
    ("text", "message"),
    [
        (_with_families(TEXT_MODELS_YAML, family="cooking"), "unknown family 'cooking'"),
        (
            TEXT_MODELS_YAML.replace("    kind: text\n", "    family: writing\n    kind: text\n"),
            "needs a families list",
        ),
        (
            _with_families(TEXT_MODELS_YAML).replace("    family: writing\n", ""),
            "family",
        ),
    ],
)
def test_load_catalog_raises_on_invalid_families(tmp_path, text, message):
    with pytest.raises(UseCasesConfigError, match=message):
        _load(tmp_path, text)


def test_real_config_lists_every_use_case_under_a_family():
    catalog = load_catalog()

    assert catalog.families == ["writing", "analysis", "office", "visual", "development"]
    assert all(uc.family in catalog.families for uc in catalog.use_cases)
