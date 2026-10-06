import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD
from backend.routes.file_routes import CRITICAL_PATHS

client = TestClient(app)

@pytest.fixture
def auth_headers():
    res = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}

def test_delete_critical_root_paths_rejected(auth_headers):
    for path in ["/", "/etc", "/bin", "C:\\", "C:\\Windows"]:
        res = client.delete(f"/api/files/delete?path={path}", headers=auth_headers)
        assert res.status_code == 403
        assert "forbidden" in res.json()["detail"].lower()

def test_unauthenticated_file_access_rejected():
    unauth = TestClient(app)
    res = unauth.get("/api/files/list?path=/workspace")
    assert res.status_code == 401
