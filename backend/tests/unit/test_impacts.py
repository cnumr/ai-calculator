import pytest

from ai_calculator.domain.impacts import (
    EcologitsComputationError,
    ModelNotFoundError,
    compute_unit_impacts,
    compute_video_unit_impacts,
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


def test_compute_video_unit_impacts_returns_ranges_for_all_five_criteria():
    result = compute_video_unit_impacts(
        model_name="google/veo-3.0", resolution="720p", duration_s=8, with_audio=True
    )

    for range_ in (result.gwp, result.energy, result.adpe, result.pe, result.water):
        assert range_ is not None
        assert range_.min > 0
        assert range_.max >= range_.min


def test_compute_video_unit_impacts_uses_the_provider_datacenter():
    # Reference: EcoLogits 0.11.3, google/veo-3.0, 720p, 8 s, with audio,
    # Google datacenter configuration (USA mix, PUE 1.09).
    result = compute_video_unit_impacts(
        model_name="google/veo-3.0", resolution="720p", duration_s=8, with_audio=True
    )

    assert result.gwp.min == pytest.approx(0.01263, rel=1e-3)
    assert result.gwp.max == pytest.approx(0.02254, rel=1e-3)


def test_compute_video_unit_impacts_grows_with_resolution():
    hd = compute_video_unit_impacts(
        model_name="google/veo-3.0", resolution="720p", duration_s=8, with_audio=True
    )
    full_hd = compute_video_unit_impacts(
        model_name="google/veo-3.0", resolution="1080p", duration_s=8, with_audio=True
    )

    assert full_hd.gwp.max > hd.gwp.max


def test_compute_video_unit_impacts_raises_model_not_found_for_unknown_model():
    with pytest.raises(ModelNotFoundError):
        compute_video_unit_impacts(
            model_name="google/veo-2", resolution="720p", duration_s=8, with_audio=True
        )
