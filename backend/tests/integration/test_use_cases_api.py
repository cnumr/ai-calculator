from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)


def test_get_use_cases_returns_200_with_providers_and_use_cases():
    response = client.get("/api/use-cases")

    assert response.status_code == 200
    body = response.json()
    assert len(body["providers"]) == 5
    assert len(body["use_cases"]) == 12
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    assert email["default_provider"] == "microsoft_copilot"
    assert email["recommended_tier"] == "eco"


def test_get_use_cases_reflects_selected_by_default():
    response = client.get("/api/use-cases")

    body = response.json()
    providers_by_id = {p["id"]: p for p in body["providers"]}
    # Every provider is offered by default; users deselect the ones they do not use.
    assert all(provider["selected_by_default"] for provider in providers_by_id.values())


def test_get_use_cases_omits_unsupported_provider_combinations():
    response = client.get("/api/use-cases")

    body = response.json()
    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    provider_ids = {p["provider_id"] for p in video["providers"]}
    assert provider_ids == {"google", "openai"}

    image = next(uc for uc in body["use_cases"] if uc["id"] == "image")
    image_provider_ids = {p["provider_id"] for p in image["providers"]}
    assert image_provider_ids == {"google", "openai"}


def test_get_use_cases_includes_cors_header_for_allowed_origin():
    response = client.get(
        "/api/use-cases", headers={"Origin": "http://localhost:5173"}
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_get_use_cases_serialises_video_parameters():
    response = client.get("/api/use-cases")

    body = response.json()
    video = next(uc for uc in body["use_cases"] if uc["id"] == "video")
    google = next(p for p in video["providers"] if p["provider_id"] == "google")
    profile = next(p for p in google["profiles"] if p["id"] == "video")

    assert profile["parameters"] == [
        {"id": "resolution", "default": "720p", "options": ["720p", "1080p"], "min": None, "max": None},
        {"id": "duration_s", "default": 8, "options": [4, 6, 8], "min": None, "max": None},
        {"id": "with_audio", "default": True, "options": [True, False], "min": None, "max": None},
    ]


def test_get_use_cases_offers_editable_output_tokens_for_text_profiles():
    response = client.get("/api/use-cases")

    body = response.json()
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    profile = email["providers"][0]["profiles"][0]
    assert profile["parameters"] == [
        {"id": "output_tokens", "default": 300, "options": None, "min": 1, "max": 10_000_000}
    ]


def test_get_use_cases_exposes_profile_model_names():
    response = client.get("/api/use-cases")

    body = response.json()
    email = next(uc for uc in body["use_cases"] if uc["id"] == "email")
    openai = next(p for p in email["providers"] if p["provider_id"] == "openai")
    eco = next(p for p in openai["profiles"] if p["id"] == "eco")
    assert eco["models"] == ["GPT-6 Luna"]


def test_get_use_cases_declares_the_kind_of_each_use_case():
    body = client.get("/api/use-cases").json()

    kinds = {uc["id"]: uc["kind"] for uc in body["use_cases"]}
    assert kinds["video"] == "video"
    assert kinds["image"] == "image"
    assert kinds["email"] == "text"


def test_get_use_cases_exposes_no_impacts():
    # Impacts are computed by POST /api/calculate.
    body = client.get("/api/use-cases").json()

    for use_case in body["use_cases"]:
        for mapping in use_case["providers"]:
            for profile in mapping["profiles"]:
                assert set(profile) == {"id", "parameters", "models"}


def test_get_use_cases_exposes_the_methodological_source():
    body = client.get("/api/use-cases").json()

    sources = {uc["id"]: uc["source"] for uc in body["use_cases"]}
    assert sources["email"]["id"] == "ecologits_llm"
    assert sources["email"]["url"].startswith("https://ecologits.ai/")
    assert sources["email"]["version"]
    assert sources["video"]["id"] == "ecologits_video"
    # Images are transposed from an EcoLogits video, described in the methodology page.
    assert sources["image"]["id"] == "image_from_video"
    assert sources["image"]["version"] == sources["video"]["version"]
    assert sources["image"]["url"] == "/methodologie#images"


def test_get_use_cases_lists_the_data_sources_and_their_versions():
    body = client.get("/api/use-cases").json()

    sources = {s["id"]: s for s in body["data_sources"]}
    assert set(sources) == {"ecologits", "impactco2"}
    assert sources["ecologits"]["version"]
    assert sources["impactco2"]["retrieved_on"]


def test_get_use_cases_lists_families_and_the_family_of_each_use_case():
    body = client.get("/api/use-cases").json()

    assert [f["id"] for f in body["families"]] == [
        "writing", "analysis", "office", "visual", "development"
    ]
    families = {uc["id"]: uc["family"] for uc in body["use_cases"]}
    assert families["email"] == "writing"
    assert families["video"] == "visual"
    assert families["dev_assistance"] == "development"
