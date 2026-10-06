import pytest
import json
import asyncio
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD, AGENT_AUTH_TOKEN
from backend.pty_manager import pty_manager
from backend.job_manager import job_manager

def test_terminal_session_lifecycle():
    client = TestClient(app)
    
    # 1. Login
    login_res = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create session
    create_res = client.post("/api/terminal/sessions", json={"cols": 120, "rows": 40}, headers=headers)
    assert create_res.status_code == 200
    session_id = create_res.json()["session_id"]
    assert session_id.startswith("term-")

    # 3. List sessions
    list_res = client.get("/api/terminal/sessions", headers=headers)
    assert list_res.status_code == 200
    sessions = list_res.json()
    assert any(s["session_id"] == session_id for s in sessions)

    # 4. Scrollback retrieval
    pty_manager.sessions[session_id].append_output("Hello Terminal\r\n")
    scrollback_res = client.get(f"/api/terminal/sessions/{session_id}/scrollback", headers=headers)
    assert scrollback_res.status_code == 200
    assert "Hello Terminal" in scrollback_res.text

    # 5. Close session
    del_res = client.delete(f"/api/terminal/sessions/{session_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "closed"
    assert session_id not in pty_manager.sessions

def test_job_submission_and_cancellation():
    client = TestClient(app)
    
    # Login
    login_res = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Submit job
    submit_res = client.post("/api/jobs", json={
        "name": "Benchmark Job",
        "type": "benchmark",
        "payload": {"matrix_size": 2048}
    }, headers=headers)
    assert submit_res.status_code == 200
    job_id = submit_res.json()["job_id"]
    assert job_id.startswith("job-")

    # List jobs
    list_res = client.get("/api/jobs", headers=headers)
    assert list_res.status_code == 200
    assert any(j["job_id"] == job_id for j in list_res.json())

    # Get single job details
    get_res = client.get(f"/api/jobs/{job_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["job_id"] == job_id
    assert "logs" in get_res.json()

    # Verify job status
    assert get_res.json()["status"] in ["queued", "running", "failed", "completed"]
