from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)


def test_get_use_cases_returns_200_with_providers_and_use_cases():
    response = client.get("/api/use-cases")

    assert response.status_code == 200
    body = response.json()
    assert len(body["providers"]) == 5
    assert len(body["use_cases"]) == 8
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    assert email["default_provider"] == "microsoft_copilot"
    assert email["recommended_tier"] == "eco"


def test_get_use_cases_reflects_selected_by_default():
    response = client.get("/api/use-cases")

    body = response.json()
    providers_by_id = {p["id"]: p for p in body["providers"]}
    assert providers_by_id["openai"]["selected_by_default"] is True
    assert providers_by_id["anthropic"]["selected_by_default"] is False
    assert providers_by_id["mistral"]["selected_by_default"] is False


def test_get_use_cases_profile_carries_five_indicators_min_max():
    response = client.get("/api/use-cases")

    body = response.json()
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    openai_mapping = next(p for p in email["providers"] if p["provider_id"] == "openai")
    eco_profile = next(p for p in openai_mapping["profiles"] if p["id"] == "eco")
    for criterion in ("gwp", "energy", "adpe", "pe", "water"):
        assert criterion in eco_profile["impacts"]
        assert eco_profile["impacts"][criterion]["max"] >= eco_profile["impacts"][criterion]["min"]


def test_get_use_cases_omits_unsupported_provider_combinations():
    response = client.get("/api/use-cases")

    body = response.json()
    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    provider_ids = {p["provider_id"] for p in video["providers"]}
    assert provider_ids == {"google", "openai"}

    image = next(uc for uc in body["use_cases"] if uc["id"] == "image")
    image_provider_ids = {p["provider_id"] for p in image["providers"]}
    assert image_provider_ids == {"google", "openai"}


def test_get_use_cases_returns_null_for_unmeasured_static_criteria():
    response = client.get("/api/use-cases")

    body = response.json()
    image = next(uc for uc in body["use_cases"] if uc["id"] == "image")
    google_mapping = next(p for p in image["providers"] if p["provider_id"] == "google")
    profile = google_mapping["profiles"][0]
    assert profile["impacts"]["gwp"] is not None
    assert profile["impacts"]["adpe"] is not None
    assert profile["impacts"]["energy"] is None
    assert profile["impacts"]["water"] is None
    assert profile["impacts"]["pe"] is None


def test_get_use_cases_returns_all_criteria_for_ecologits_video():
    response = client.get("/api/use-cases")

    body = response.json()
    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    profile = video["providers"][0]["profiles"][0]
    for criterion in ("gwp", "energy", "adpe", "pe", "water"):
        assert profile["impacts"][criterion] is not None


def test_get_use_cases_includes_cors_header_for_allowed_origin():
    response = client.get(
        "/api/use-cases", headers={"Origin": "http://localhost:5173"}
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_get_use_cases_serialises_video_parameters_and_variants():
    response = client.get("/api/use-cases")

    body = response.json()
    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    google = next(p for p in video["providers"] if p["provider_id"] == "google")
    profile = next(p for p in google["profiles"] if p["id"] == "video")

    assert profile["parameters"] == [
        {"id": "resolution", "options": ["720p", "1080p"], "default": "720p"},
        {"id": "duration_s", "options": [5, 8, 10], "default": 8},
        {"id": "with_audio", "options": [True, False], "default": True},
    ]
    assert len(profile["variants"]) == 12
    default_variant = next(
        v
        for v in profile["variants"]
        if v["values"] == {"resolution": "720p", "duration_s": 8, "with_audio": True}
    )
    assert default_variant["impacts"] == profile["impacts"]


def test_get_use_cases_gives_text_profiles_empty_parameters():
    response = client.get("/api/use-cases")

    body = response.json()
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    profile = email["providers"][0]["profiles"][0]
    assert profile["parameters"] == []
    assert profile["variants"] == []


def test_get_use_cases_exposes_profile_model_names():
    response = client.get("/api/use-cases")

    body = response.json()
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    openai = next(p for p in email["providers"] if p["provider_id"] == "openai")
    eco = next(p for p in openai["profiles"] if p["id"] == "eco")
    assert eco["models"] == ["GPT-4o mini"]
    assert eco["output_tokens"] == 300

    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    assert video["providers"][0]["profiles"][0]["output_tokens"] is None
