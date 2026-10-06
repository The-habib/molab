import pytest
import asyncio
from backend.agent_manager import agent_manager

class MockWebSocket:
    def __init__(self):
        self.sent_messages = []
        self.closed = False

    async def send_text(self, text: str):
        self.sent_messages.append(text)

    async def close(self):
        self.closed = True

@pytest.mark.asyncio
async def test_multi_pod_registration_and_switching():
    # 1. Register Pod 1
    ws1 = MockWebSocket()
    reg1 = {
        "hostname": "molab-pod-alpha",
        "agent_id": "pod-1",
        "os": "Linux",
        "gpu_name": "NVIDIA RTX PRO 6000 Blackwell",
        "vram_total_gb": 94.97
    }
    ack1 = await agent_manager.register_agent(ws1, reg1)
    assert ack1["status"] == "registered"
    assert ack1["pod_id"] == "molab-pod-alpha"
    assert agent_manager.active_pod_id == "molab-pod-alpha"

    # 2. Register Pod 2
    ws2 = MockWebSocket()
    reg2 = {
        "hostname": "molab-pod-beta",
        "agent_id": "pod-2",
        "os": "Linux",
        "gpu_name": "NVIDIA H100 SXM5",
        "vram_total_gb": 80.0
    }
    ack2 = await agent_manager.register_agent(ws2, reg2)
    assert ack2["status"] == "registered"
    assert ack2["pod_id"] == "molab-pod-beta"

    # Verify both pods are listed
    pods = agent_manager.list_pods()
    assert len(pods) == 2
    hostnames = [p["hostname"] for p in pods]
    assert "molab-pod-alpha" in hostnames
    assert "molab-pod-beta" in hostnames

    # 3. Switch active pod
    assert agent_manager.select_pod("molab-pod-beta") is True
    assert agent_manager.active_pod_id == "molab-pod-beta"
    assert agent_manager.agent_info["gpu_name"] == "NVIDIA H100 SXM5"

    # 4. Disconnect Pod 2, Pod 1 remains alive
    agent_manager.disconnect_agent("molab-pod-beta")
    assert agent_manager.is_online is True
    assert len(agent_manager.list_pods()) == 1
    assert agent_manager.active_pod_id == "molab-pod-alpha"

    # Clean up
    agent_manager.disconnect_agent("molab-pod-alpha")
    assert agent_manager.is_online is False
