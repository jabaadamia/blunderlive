from fastapi.testclient import TestClient

from app.main import app


def test_root() -> None:
    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == app.state.settings.app_name # type: ignore[attr-defined]
    assert response.json()["redis"] == "ok"
    assert response.json()["auth_algorithm"] == "RS256"
