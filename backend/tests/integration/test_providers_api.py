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


def test_get_providers_includes_cors_header_for_allowed_origin():
    response = client.get(
        "/api/providers", headers={"Origin": "http://localhost:5173"}
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
