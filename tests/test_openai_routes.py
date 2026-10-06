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

@pytest.mark.asyncio
async def test_openai_compatible_endpoints():
    # Register mock pod
    ws = MockWebSocket()
    reg = {
        "hostname": "molab-blackwell-gpu-master",
        "agent_id": "pod-bw-master",
        "os": "Linux",
        "gpu_name": "NVIDIA RTX PRO 6000 Blackwell",
        "vram_total_gb": 94.97
    }
    await agent_manager.register_agent(ws, reg)

    # 1. Test /v1/models with master API key
    headers = {"Authorization": "Bearer sk-molab-blackwell-cluster"}
    res = client.get("/v1/models", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["object"] == "list"
    assert any(m["id"] == "hermes3:latest" for m in data["data"])

    # 2. Test unauthorized without key
    res_unauth = client.get("/v1/models", headers={"Authorization": "Bearer invalid-key"})
    assert res_unauth.status_code == 401

    # Cleanup
    agent_manager.disconnect_agent("molab-blackwell-gpu-master")
