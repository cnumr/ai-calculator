from dataclasses import dataclass

import pytest

from ai_calculator.domain.equivalents import load_equivalents
from ai_calculator.domain.impacts import ImpactRange, UnitImpacts
from ai_calculator.domain.scenario import (
    WORKING_DAYS_PER_YEAR,
    ScenarioError,
    UsageInput,
    compute_scenario,
)
from ai_calculator.domain.use_cases import (
    Catalog,
    ResolvedProfile,
    ResolvedProviderMapping,
    ResolvedUseCase,
    load_catalog,
)

# The "image" use case of these tests uses fixed impacts (kg CO2eq per
# action), defined here, so totals are exact and easy to check; the video use
# case is loaded from YAML and computed by EcoLogits.
CATALOG_YAML = """
model_labels:
  google/veo-3.0: Veo 3
providers:
  - id: openai
    selected_by_default: true
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
              model: google/veo-3.0
              defaults: {resolution: 720p, duration_s: 8, with_audio: true}
"""


@dataclass(frozen=True)
class FixedCalculation:
    impacts: UnitImpacts

    def unit_impacts(self, values):
        return self.impacts


def _fixed_profile(gwp, adpe=None):
    return ResolvedProfile(
        id="image",
        calculation=FixedCalculation(
            UnitImpacts(gwp=gwp, energy=None, adpe=adpe, pe=None, water=None)
        ),
    )


@pytest.fixture
def catalog(tmp_path):
    config_file = tmp_path / "use_cases.yaml"
    config_file.write_text(CATALOG_YAML)
    loaded = load_catalog(config_file)
    image_use_case = ResolvedUseCase(
        id="image",
        kind="image",
        subtitle_key="useCases.image.subtitle",
        default_provider="google",
        recommended_tier="image",
        providers=[
            ResolvedProviderMapping(
                provider_id="openai", profiles=[_fixed_profile(ImpactRange(1.0, 2.0))]
            ),
            ResolvedProviderMapping(
                provider_id="google",
                profiles=[
                    _fixed_profile(ImpactRange(3.0, 6.0), adpe=ImpactRange(0.5, 0.5))
                ],
            ),
        ],
        source=loaded.use_cases[0].source,
    )
    return Catalog(providers=loaded.providers, use_cases=[image_use_case, *loaded.use_cases])


def image(provider_id, frequency, **overrides):
    return UsageInput(
        kind=overrides.get("kind", "image"),
        use_case_id="image",
        provider_id=provider_id,
        profile_id=overrides.get("profile_id", "image"),
        frequency=frequency,
        frequency_unit=overrides.get("frequency_unit", "day"),
        parameters=overrides.get("parameters", {}),
    )


def video(**parameters):
    return UsageInput(
        kind="video",
        use_case_id="video",
        provider_id="google",
        profile_id="video",
        frequency=1,
        parameters=parameters,
    )


def test_usage_impacts_scale_by_frequency_then_working_days(catalog):
    result = compute_scenario(catalog, [image("openai", 3)], headcount=1)

    usage = result.usages[0]
    assert usage.unit_impacts.gwp == ImpactRange(1.0, 2.0)
    assert usage.daily_impacts.gwp == ImpactRange(3.0, 6.0)
    assert usage.annual_impacts.gwp == ImpactRange(
        3.0 * WORKING_DAYS_PER_YEAR, 6.0 * WORKING_DAYS_PER_YEAR
    )
    assert result.working_days_per_year == 218


def test_individual_total_sums_usages_and_enterprise_scales_by_headcount(catalog):
    result = compute_scenario(
        catalog, [image("openai", 1), image("google", 1)], headcount=10
    )

    # (1 + 3) and (2 + 6) kg per day, over 218 days
    assert result.individual_annual.gwp == ImpactRange(4.0 * 218, 8.0 * 218)
    assert result.enterprise_annual.gwp == ImpactRange(40.0 * 218, 80.0 * 218)


def test_missing_criteria_count_as_zero_in_totals(catalog):
    result = compute_scenario(
        catalog, [image("openai", 1), image("google", 1)], headcount=1
    )

    # openai has no ADPe, google has 0.5 kg Sbeq per action
    assert result.individual_annual.adpe == ImpactRange(0.5 * 218, 0.5 * 218)
    # nobody measures energy: the total stays a (zero) number, not None
    assert result.individual_annual.energy == ImpactRange(0.0, 0.0)
    # per usage, a missing criterion stays None
    assert result.usages[0].annual_impacts.adpe is None


def test_empty_scenario_gives_zero_totals(catalog):
    result = compute_scenario(catalog, [], headcount=1)

    assert result.usages == []
    assert result.individual_annual.gwp == ImpactRange(0.0, 0.0)
    assert result.provider_breakdown == []
    assert all(e.quantity == 0 for e in result.co2_equivalents)


def test_provider_breakdown_groups_usages_and_shares_gwp_max(catalog):
    result = compute_scenario(
        catalog,
        [image("google", 1), image("openai", 1), image("google", 1)],
        headcount=1,
    )

    # order of first appearance; google 6 + 6, openai 2 (gwp max per day)
    assert [s.provider_id for s in result.provider_breakdown] == ["google", "openai"]
    google, openai = result.provider_breakdown
    assert google.annual_impacts.gwp == ImpactRange(6.0 * 218, 12.0 * 218)
    assert google.gwp_share_percent == pytest.approx(12 / 14 * 100)
    assert openai.gwp_share_percent == pytest.approx(2 / 14 * 100)


def test_co2_equivalents_use_the_individual_gwp_max(catalog):
    result = compute_scenario(catalog, [image("openai", 1)], headcount=50)

    factors = {e.id: e for e in load_equivalents()}
    individual_max = 2.0 * 218
    car = next(e for e in result.co2_equivalents if e.id == "car_km")
    assert car.impact_co2_slug == "voiturethermique"
    assert car.quantity == pytest.approx(individual_max / factors["car_km"].kg_co2eq_per_unit)
    assert [e.id for e in result.co2_equivalents] == [e.id for e in load_equivalents()]


def test_video_parameters_are_resolved_and_change_the_impacts(catalog):
    default, full_hd = compute_scenario(
        catalog, [video(), video(resolution="1080p")], headcount=1
    ).usages

    assert default.parameters == {"resolution": "720p", "duration_s": 8, "with_audio": True}
    assert full_hd.parameters["resolution"] == "1080p"
    assert full_hd.unit_impacts.gwp.max > default.unit_impacts.gwp.max


@pytest.mark.parametrize(
    "unit, per_year",
    [("day", 218), ("week", 218 / 5), ("month", 11)],
)
def test_frequency_unit_sets_actions_per_year(catalog, unit, per_year):
    usage = compute_scenario(
        catalog, [image("openai", 2, frequency_unit=unit)], headcount=1
    ).usages[0]

    assert usage.frequency == 2
    assert usage.frequency_unit == unit
    # Daily impacts stay per working day, so usages compare with each other.
    assert usage.frequency_per_day == pytest.approx(2 * per_year / 218)
    assert usage.annual_impacts.gwp.max == pytest.approx(
        usage.unit_impacts.gwp.max * 2 * per_year
    )


def test_a_weekly_usage_is_a_fifth_of_the_same_daily_usage(catalog):
    daily, weekly = compute_scenario(
        catalog,
        [image("openai", 5), image("openai", 5, frequency_unit="week")],
        headcount=1,
    ).usages

    assert weekly.daily_impacts.gwp.max == pytest.approx(daily.daily_impacts.gwp.max / 5)


@pytest.mark.parametrize(
    "usage, message",
    [
        (image("openai", 1, profile_id="powerful"), "profile 'powerful'"),
        (image("mistral", 1), "provider 'mistral'"),
        (image("openai", 1, kind="text"), "kind 'text'"),
        (image("openai", -1), "frequency must be positive"),
        (image("openai", 1, frequency_unit="year"), "unknown frequency unit"),
        (image("openai", 1, parameters={"resolution": "720p"}), "unknown parameter"),
        (video(resolution="4k"), "resolution"),
    ],
)
def test_invalid_usages_raise_a_scenario_error(catalog, usage, message):
    with pytest.raises(ScenarioError, match=message):
        compute_scenario(catalog, [usage], headcount=1)


def test_headcount_must_be_at_least_one(catalog):
    with pytest.raises(ScenarioError, match="headcount"):
        compute_scenario(catalog, [], headcount=0)
