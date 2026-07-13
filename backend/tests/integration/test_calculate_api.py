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


def test_calculate_returns_404_for_unknown_model():
    payload = {**VALID_PAYLOAD, "model": "does-not-exist"}

    response = client.post("/api/calculate", json=payload)

    assert response.status_code == 404
    assert "detail" in response.json()
    assert response.json()["detail"]  # non-empty string


def test_calculate_returns_502_for_ecologits_computation_error(monkeypatch):
    from unittest.mock import MagicMock
    from ai_calculator.domain.impacts import EcologitsComputationError
    from ai_calculator.api import calculate as calculate_module

    mock_compute_unit_impacts = MagicMock(
        side_effect=EcologitsComputationError("computation failed")
    )
    monkeypatch.setattr(
        calculate_module, "compute_unit_impacts", mock_compute_unit_impacts
    )

    response = client.post("/api/calculate", json=VALID_PAYLOAD)

    assert response.status_code == 502
    body = response.json()
    assert "detail" in body
    assert body["detail"]  # non-empty string
    assert "computation failed" in body["detail"]


def test_calculate_returns_422_for_non_positive_output_tokens():
    payload = {**VALID_PAYLOAD, "output_tokens": 0}

    response = client.post("/api/calculate", json=payload)

    assert response.status_code == 422
