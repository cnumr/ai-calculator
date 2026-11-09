"""Capabilities of EcoLogits video models (resolutions, durations, audio).

EcoLogits computes video impacts for any resolution and duration it is given,
but each model only supports some of them (`capabilities` in its data file).
EcoLogits does not enforce these, so the calculator reads them here to offer
and validate only supported parameter values.
"""

import json
from dataclasses import dataclass
from functools import cache
from importlib.resources import files

from ai_calculator.domain.impacts import ModelNotFoundError

# Named resolutions understood by EcoLogits (`estimations.video.parse_resolution`).
_RESOLUTION_NAMES = {
    (1280, 720): "720p",
    (1920, 1080): "1080p",
    (3840, 2160): "4k",
}

# EcoLogits generates at 24 fps: frames = duration * 24 + 1.
_FPS = 24


@dataclass(frozen=True)
class VideoCapabilities:
    resolutions: list[str]
    durations_s: list[int | float]
    audio: list[bool]


@cache
def _models_info() -> dict[str, dict]:
    data_file = files("ecologits").joinpath("data", "video_models.json")
    data = json.loads(data_file.read_text(encoding="utf-8"))
    return {model["model_name"]: model for model in data["models"]}


def _resolution_name(width: int, height: int) -> str:
    return _RESOLUTION_NAMES.get((width, height), f"{width}x{height}")


def _duration_s(frames_count: int) -> int | float:
    duration = (frames_count - 1) / _FPS
    return int(duration) if duration.is_integer() else duration


def video_capabilities(model_name: str) -> VideoCapabilities:
    model = _models_info().get(model_name)
    if model is None:
        provider = model_name.split("/", 1)[0]
        raise ModelNotFoundError(provider, model_name)
    capabilities = model["capabilities"]
    return VideoCapabilities(
        resolutions=[_resolution_name(w, h) for w, h in capabilities["resolutions"]],
        durations_s=[_duration_s(f) for f in capabilities["frames_count"]],
        audio=[True, False] if capabilities["audio_generation"] else [False],
    )
