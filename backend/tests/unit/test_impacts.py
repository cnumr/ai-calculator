import pytest

from ai_calculator.domain.impacts import (
    EcologitsComputationError,
    ModelNotFoundError,
    compute_unit_impacts,
)


def test_compute_unit_impacts_returns_ranges_for_all_five_criteria():
    result = compute_unit_impacts(
        provider="openai", model_name="gpt-4o-mini", output_tokens=200
    )

    for range_ in (result.gwp, result.energy, result.adpe, result.pe, result.water):
        assert range_.min >= 0
        assert range_.max >= range_.min


def test_compute_unit_impacts_scales_with_output_tokens():
    small = compute_unit_impacts(
        provider="openai", model_name="gpt-4o-mini", output_tokens=100
    )
    large = compute_unit_impacts(
        provider="openai", model_name="gpt-4o-mini", output_tokens=1000
    )

    assert large.gwp.max > small.gwp.max


def test_compute_unit_impacts_raises_model_not_found_for_unknown_model():
    with pytest.raises(ModelNotFoundError):
        compute_unit_impacts(
            provider="openai", model_name="does-not-exist", output_tokens=100
        )
