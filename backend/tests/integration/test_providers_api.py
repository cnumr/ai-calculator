from fastapi.testclient import TestClient

from ai_calculator.main import app

client = TestClient(app)


def test_get_providers_returns_200_with_model_list():
    response = client.get("/api/providers")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) > 0
    assert "provider" in body[0]
    assert "name" in body[0]
