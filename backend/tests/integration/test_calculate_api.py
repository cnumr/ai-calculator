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


def test_legacy_calculate_endpoint_is_removed():
    # L'agrégation annuelle est faite côté front à partir de GET /api/use-cases.
    response = client.post("/api/calculate", json=VALID_PAYLOAD)

    assert response.status_code == 404
