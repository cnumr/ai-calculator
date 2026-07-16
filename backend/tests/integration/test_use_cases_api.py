from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)


def test_get_use_cases_returns_200_with_providers_and_use_cases():
    response = client.get("/api/use-cases")

    assert response.status_code == 200
    body = response.json()
    assert len(body["providers"]) == 5
    assert len(body["use_cases"]) == 8


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
    assert provider_ids == {"google"}

    image = next(uc for uc in body["use_cases"] if uc["id"] == "image")
    image_provider_ids = {p["provider_id"] for p in image["providers"]}
    assert image_provider_ids == {"google", "openai"}


def test_get_use_cases_returns_null_for_unmeasured_static_criteria():
    response = client.get("/api/use-cases")

    body = response.json()
    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    google_mapping = next(p for p in video["providers"] if p["provider_id"] == "google")
    profile = google_mapping["profiles"][0]
    assert profile["impacts"]["gwp"] is not None
    assert profile["impacts"]["adpe"] is not None
    assert profile["impacts"]["energy"] is None
    assert profile["impacts"]["water"] is None
    assert profile["impacts"]["pe"] is None


def test_get_use_cases_includes_cors_header_for_allowed_origin():
    response = client.get(
        "/api/use-cases", headers={"Origin": "http://localhost:5173"}
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
