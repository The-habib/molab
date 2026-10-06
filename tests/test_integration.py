import pytest
import asyncio
import json
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD, AGENT_AUTH_TOKEN
from backend.agent_manager import agent_manager

def test_full_agent_handshake_and_rpc():
    client = TestClient(app)

    # 1. Login admin
    login_res = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Before agent connects, online is False
    res = client.get("/api/dashboard/summary", headers=headers)
    assert res.json()["online"] is False

    # 2. Connect agent over WebSocket with valid auth token
    with client.websocket_connect(f"/ws/agent?token={AGENT_AUTH_TOKEN}") as ws:
        # Send registration
        reg_payload = {
            "agent_id": "test-agent-blackwell",
            "hostname": "molab-cloud-pod",
            "os": "Linux",
            "os_release": "6.6.137+",
            "arch": "x86_64",
            "cpu_count": 16,
            "gpu": {
                "cuda_available": True,
                "gpu_name": "NVIDIA RTX PRO 6000 Blackwell Server Edition",
                "vram_total_gb": 94.97,
                "vram_used_gb": 0.64,
                "vram_free_gb": 94.33,
                "vram_percent": 1,
                "cuda_version": "13.0",
                "torch_version": "2.11.0+cu130"
            }
        }
        ws.send_text(json.dumps(reg_payload))
        ack_str = ws.receive_text()
        ack = json.loads(ack_str)
        assert ack["status"] == "registered"

        # Verify controller now reports agent as online!
        res = client.get("/api/dashboard/summary", headers=headers)
        assert res.json()["online"] is True
        assert res.json()["agent"]["hostname"] == "molab-cloud-pod"

        # Send heartbeat
        hb = {
            "type": "heartbeat",
            "timestamp": 123456789.0,
            "telemetry": {
                "cpu": {"cpu_percent": 12.5, "cpu_count": 16},
                "memory": {"ram_total_gb": 128.0, "ram_used_gb": 16.4, "ram_free_gb": 111.6, "ram_percent": 12.8},
                "disk": {"disk_total_gb": 500.0, "disk_used_gb": 45.0, "disk_free_gb": 455.0, "disk_percent": 9.0},
                "network": {"rx_kbs": 120.4, "tx_kbs": 45.2, "total_rx_mb": 1024.0, "total_tx_mb": 512.0},
                "gpu": {
                    "cuda_available": True,
                    "gpu_name": "NVIDIA RTX PRO 6000 Blackwell Server Edition",
                    "vram_total_gb": 94.97,
                    "vram_used_gb": 0.64,
                    "vram_free_gb": 94.33,
                    "vram_percent": 1,
                    "temperature_c": 38,
                    "utilization_pct": 5,
                    "power_draw_w": 65.0
                }
            }
        }
        ws.send_text(json.dumps(hb))
        hb_ack_str = ws.receive_text()
        hb_ack = json.loads(hb_ack_str)
        assert hb_ack["type"] == "heartbeat_ack"

        # Verify telemetry query
        res = client.get("/api/dashboard/summary", headers=headers)
        assert res.json()["telemetry"]["cpu"]["cpu_percent"] == 12.5
        assert res.json()["telemetry"]["gpu"]["gpu_name"] == "NVIDIA RTX PRO 6000 Blackwell Server Edition"
