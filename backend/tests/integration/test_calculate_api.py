from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)

VALID_PAYLOAD = {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "output_tokens": 200,
    "requests_per_day": 10,
    "working_days_per_year": 220,
    "headcount": 50,
}


def test_calculate_returns_200_with_three_aggregation_levels():
    response = client.post("/api/calculate", json=VALID_PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    for level in ("unit", "individual_annual", "enterprise_annual"):
        assert level in body
        for criterion in ("gwp", "energy", "adpe", "pe", "water"):
            assert criterion in body[level]
            assert body[level][criterion]["max"] >= body[level][criterion]["min"]


def test_calculate_enterprise_annual_scales_up_from_unit():
    response = client.post("/api/calculate", json=VALID_PAYLOAD)

    body = response.json()
    assert body["enterprise_annual"]["gwp"]["max"] > body["unit"]["gwp"]["max"]
