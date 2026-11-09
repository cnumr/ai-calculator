import pytest

from ai_calculator.domain.impacts import ModelNotFoundError
from ai_calculator.domain.video import video_capabilities


def test_video_capabilities_for_veo_3_0():
    capabilities = video_capabilities("google/veo-3.0")

    assert capabilities.resolutions == ["720p", "1080p"]
    assert capabilities.durations_s == [5, 8, 10]
    assert capabilities.audio == [True, False]


def test_video_capabilities_differ_per_model():
    assert video_capabilities("google/veo-3.0-fast").durations_s == [4, 6, 8]
    assert video_capabilities("openai/sora-2-pro").durations_s == [4, 8, 12]


def test_video_capabilities_names_unusual_resolutions_in_pixels():
    capabilities = video_capabilities("bytedance/seedance-1.0")

    assert capabilities.resolutions == ["854x480", "720p"]


def test_video_capabilities_offers_no_audio_when_the_model_has_none():
    assert video_capabilities("runway/gen-4.5").audio == [False]


def test_video_capabilities_raises_for_unknown_model():
    with pytest.raises(ModelNotFoundError):
        video_capabilities("google/veo-2")
