from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_public_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok", "service": "greentrack-api"}


def test_only_health_is_published():
    assert set(app.openapi()["paths"]) == {"/api/v1/health"}
    assert client.get("/health").status_code == 404
