import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.auth import create_session
from backend.agent_manager import agent_manager

client = TestClient(app)

class MockWebSocket:
    def __init__(self):
        self.sent_messages = []
        self.closed = False

    async def send_text(self, text: str):
        self.sent_messages.append(text)

    async def close(self):
        self.closed = True

@pytest.fixture
def auth_headers():
    session_id = create_session("admin")
    return {"Authorization": f"Bearer {session_id}"}

@pytest.mark.asyncio
async def test_llm_cluster_endpoints(auth_headers):
    # Register a mock Blackwell GPU pod
    ws = MockWebSocket()
    reg = {
        "hostname": "molab-blackwell-gpu-01",
        "agent_id": "pod-bw-1",
        "os": "Linux",
        "gpu_name": "NVIDIA RTX PRO 6000 Blackwell",
        "vram_total_gb": 94.97
    }
    await agent_manager.register_agent(ws, reg)

    # 1. Test cluster endpoint
    res = client.get("/api/llm/cluster", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_nodes"] >= 1
    assert data["total_vram_gb"] >= 94.97
    assert "hermes3" in data["active_llm_model"].lower()

    # 2. Test models endpoint
    res_models = client.get("/api/llm/models", headers=auth_headers)
    assert res_models.status_code == 200
    m_data = res_models.json()
    assert len(m_data["available_models"]) >= 1
    assert m_data["available_models"][0]["name"] == "hermes3:latest"
    assert m_data["cluster_vram_gb"] >= 94.97

    # Cleanup
    agent_manager.disconnect_agent("molab-blackwell-gpu-01")
