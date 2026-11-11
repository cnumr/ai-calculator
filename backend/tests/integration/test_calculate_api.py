import pytest
from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)

EMAIL = {
    "kind": "text",
    "use_case_id": "email",
    "provider_id": "openai",
    "profile_id": "eco",
    "frequency": 3,
}
VIDEO = {
    "kind": "video",
    "use_case_id": "video",
    "provider_id": "google",
    "profile_id": "video",
    "frequency": 1,
    "parameters": {"resolution": "1080p"},
}
IMAGE = {
    "kind": "image",
    "use_case_id": "image",
    "provider_id": "google",
    "profile_id": "image",
    "frequency": 2,
}


def test_calculate_returns_usages_totals_breakdown_and_equivalents():
    response = client.post(
        "/api/calculate", json={"headcount": 10, "usages": [EMAIL, VIDEO, IMAGE]}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["working_days_per_year"] == 218
    assert [u["use_case_id"] for u in body["usages"]] == ["email", "video", "image"]
    email = body["usages"][0]
    assert email["frequency"] == 3
    assert email["frequency_unit"] == "day"
    assert email["frequency_per_day"] == 3
    assert email["daily_impacts"]["gwp"]["max"] == pytest.approx(
        email["unit_impacts"]["gwp"]["max"] * 3
    )
    assert email["annual_impacts"]["gwp"]["max"] == pytest.approx(
        email["daily_impacts"]["gwp"]["max"] * 218
    )
    individual_max = body["individual_annual"]["gwp"]["max"]
    assert individual_max == pytest.approx(
        sum(u["annual_impacts"]["gwp"]["max"] for u in body["usages"])
    )
    assert body["enterprise_annual"]["gwp"]["max"] == pytest.approx(individual_max * 10)
    assert {s["provider_id"] for s in body["provider_breakdown"]} == {"openai", "google"}
    assert sum(s["gwp_share_percent"] for s in body["provider_breakdown"]) == pytest.approx(100)
    assert {e["impact_co2_slug"] for e in body["co2_equivalents"]} == {
        "streamingvideo",
        "smartphone",
        "voiturethermique",
    }


def test_calculate_fills_in_video_parameter_defaults():
    response = client.post("/api/calculate", json={"usages": [VIDEO]})

    assert response.json()["usages"][0]["parameters"] == {
        "resolution": "1080p",
        "duration_s": 8,
        "with_audio": True,
    }


def test_calculate_transposes_images_from_the_reference_video_per_size():
    video = {**VIDEO, "parameters": {"resolution": "720p", "duration_s": 8, "with_audio": True}}
    body = client.post(
        "/api/calculate",
        json={
            "usages": [
                video,
                IMAGE,
                {**IMAGE, "parameters": {"size": "2048x2048"}},
            ]
        },
    ).json()
    clip, small, large = (u["unit_impacts"] for u in body["usages"])

    assert body["usages"][1]["parameters"] == {"size": "1024x1024"}
    for criterion in ("gwp", "energy", "adpe", "pe", "water"):
        assert small[criterion]["min"] == pytest.approx(clip[criterion]["min"] / 30)
        assert small[criterion]["max"] == pytest.approx(clip[criterion]["max"] / 30)
        assert large[criterion]["max"] == pytest.approx(clip[criterion]["max"] / 8)


def test_calculate_defaults_headcount_to_one():
    body = client.post("/api/calculate", json={"usages": [EMAIL]}).json()

    assert body["enterprise_annual"] == body["individual_annual"]


def test_calculate_converts_a_monthly_frequency_to_working_days():
    response = client.post(
        "/api/calculate",
        json={"usages": [{**VIDEO, "frequency": 2, "frequency_unit": "month"}]},
    )

    assert response.status_code == 200
    video = response.json()["usages"][0]
    assert video["frequency"] == 2
    assert video["frequency_unit"] == "month"
    # 2 per month, 11 worked months: 22 a year, spread over 218 working days.
    assert video["frequency_per_day"] == pytest.approx(22 / 218)
    assert video["annual_impacts"]["gwp"]["max"] == pytest.approx(
        video["unit_impacts"]["gwp"]["max"] * 22
    )


def test_calculate_still_accepts_the_former_frequency_per_day_field():
    legacy = {k: v for k, v in EMAIL.items() if k != "frequency"}
    response = client.post(
        "/api/calculate", json={"usages": [{**legacy, "frequency_per_day": 3}]}
    )

    assert response.status_code == 200
    email = response.json()["usages"][0]
    assert email["frequency"] == 3
    assert email["frequency_unit"] == "day"


@pytest.mark.parametrize(
    "payload",
    [
        # each kind only accepts its own parameters
        {"usages": [{**EMAIL, "parameters": {"resolution": "720p"}}]},
        {"usages": [{**IMAGE, "parameters": {"output_tokens": 10}}]},
        {"usages": [{**IMAGE, "parameters": {"size": "4096x4096"}}]},
        {"usages": [{**EMAIL, "parameters": {"output_tokens": 0}}]},
        {"usages": [{**EMAIL, "parameters": {"output_tokens": 12.5}}]},
        # unknown video parameter
        {"usages": [{**VIDEO, "parameters": {"fps": 30}}]},
        # unknown kind
        {"usages": [{**EMAIL, "kind": "audio"}]},
        {"usages": [{**EMAIL, "frequency": -1}]},
        {"usages": [{**EMAIL, "frequency_unit": "year"}]},
        {"usages": [EMAIL], "headcount": 0},
        {"usages": [EMAIL] * 51},
    ],
)
def test_calculate_rejects_malformed_requests(payload):
    assert client.post("/api/calculate", json=payload).status_code == 422


@pytest.mark.parametrize(
    "usage, message",
    [
        ({**EMAIL, "profile_id": "unknown"}, "profile 'unknown'"),
        ({**EMAIL, "kind": "video"}, "kind 'video'"),
        ({**VIDEO, "parameters": {"resolution": "4k"}}, "resolution"),
        ({**VIDEO, "parameters": {"duration_s": 12}}, "duration_s"),
    ],
)
def test_calculate_explains_invalid_selections(usage, message):
    response = client.post("/api/calculate", json={"usages": [usage]})

    assert response.status_code == 422
    assert message in response.json()["detail"]


def test_openapi_documents_parameters_per_use_case_kind():
    schemas = client.get("/openapi.json").json()["components"]["schemas"]

    assert "parameters" in schemas["VideoUsageIn"]["properties"]
    assert "parameters" in schemas["TextUsageIn"]["properties"]
    assert "parameters" in schemas["ImageUsageIn"]["properties"]
    assert set(schemas["ImageParametersIn"]["properties"]) == {"size"}
    assert set(schemas["TextParametersIn"]["properties"]) == {"output_tokens"}
    assert set(schemas["VideoParametersIn"]["properties"]) == {
        "resolution",
        "duration_s",
        "with_audio",
    }


def test_calculate_uses_the_chosen_output_tokens():
    default = client.post("/api/calculate", json={"usages": [EMAIL]}).json()["usages"][0]
    custom = client.post(
        "/api/calculate",
        json={"usages": [{**EMAIL, "parameters": {"output_tokens": 3000}}]},
    ).json()["usages"][0]

    assert default["parameters"] == {"output_tokens": 300}
    assert custom["parameters"] == {"output_tokens": 3000}
    assert custom["unit_impacts"]["gwp"]["max"] > default["unit_impacts"]["gwp"]["max"]
