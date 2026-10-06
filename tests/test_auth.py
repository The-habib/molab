import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD, AGENT_AUTH_TOKEN
from backend.auth import verify_agent_token, create_session, validate_session

client = TestClient(app)

def test_health_endpoint_public():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "cloud-pc-control"

def test_login_invalid_credentials():
    res = client.post("/api/auth/login", json={"username": "admin", "password": "wrong_password"})
    assert res.status_code == 401

def test_login_valid_credentials():
    res = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["username"] == ADMIN_USERNAME

def test_protected_routes_require_auth():
    unauth = TestClient(app)
    res = unauth.get("/api/dashboard/summary")
    assert res.status_code == 401

    res = unauth.get("/api/processes")
    assert res.status_code == 401

    res = unauth.get("/api/audit/logs")
    assert res.status_code == 401

def test_protected_routes_with_valid_token():
    # Login first
    login_res = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    token = login_res.json()["token"]

    headers = {"Authorization": f"Bearer {token}"}
    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "online" in data
    assert "latency_ms" in data

def test_agent_token_verification():
    assert verify_agent_token(AGENT_AUTH_TOKEN) is True
    assert verify_agent_token("invalid_agent_token") is False
    assert verify_agent_token("") is False
