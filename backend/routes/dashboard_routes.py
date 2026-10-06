import asyncio
import json
import time
from pathlib import Path
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from backend.auth import get_current_user, verify_websocket_user
from backend.agent_manager import agent_manager
from backend.pty_manager import pty_manager
from backend.job_manager import job_manager

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary")
async def get_dashboard_summary(user: dict = Depends(get_current_user)):
    is_online = agent_manager.is_online
    agent_info = agent_manager.agent_info if is_online else {}
    telemetry = agent_manager.latest_telemetry if is_online else {}

    jobs = job_manager.list_jobs()
    running_jobs = sum(1 for j in jobs if j["status"] == "running")

    # Read active tunnel runtime for client connect instructions
    tunnel_file = Path(__file__).resolve().parent.parent.parent / "tunnel_runtime.json"
    tunnel_url = None
    if tunnel_file.is_file():
        try:
            with open(tunnel_file, "r", encoding="utf-8") as f:
                tunnel_url = json.load(f).get("public_https_url")
        except Exception:
            pass

    base_https = tunnel_url or "http://127.0.0.1:8800"
    clean_host = base_https.replace("https://", "").replace("http://", "").rstrip("/")
    ws_proto = "wss" if "https://" in base_https else "ws"
    base_wss = f"{ws_proto}://{clean_host}/ws/agent"

    from backend.config import AGENT_AUTH_TOKEN
    molab_command = (
        f'python3 -m pip install -q websockets psutil && '
        f'curl -fsSL "{base_https}/agent.py" -o agent.py && '
        f'pkill -9 -f agent.py 2>/dev/null; '
        f'nohup python3 agent.py --wss "{base_wss}" --token "{AGENT_AUTH_TOKEN}" > agent.log 2>&1 & '
        f'sleep 1; pgrep -f agent.py >/dev/null && echo "[OK] Connected to Cloud PC!"'
    )
    molab_short_command = f"curl -fsSL {tunnel_url}/agent.sh | bash" if tunnel_url else "curl -fsSL http://127.0.0.1:8800/agent.sh | bash"

    return {
        "online": is_online,
        "latency_ms": round(agent_manager.latency_ms, 1),
        "last_heartbeat": agent_manager.last_heartbeat,
        "agent": agent_info,
        "telemetry": telemetry,
        "active_terminal_sessions": len(pty_manager.sessions),
        "running_jobs": running_jobs,
        "total_jobs": len(jobs),
        "tunnel_url": tunnel_url,
        "molab_command": molab_command,
        "molab_short_command": molab_short_command,
        "timestamp": time.time()
    }


@router.websocket("/ws")
async def dashboard_websocket(websocket: WebSocket):
    user = await verify_websocket_user(websocket)
    if not user:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    await websocket.accept()
    q = agent_manager.subscribe_telemetry()

    try:
        # Send initial summary
        init_summary = {
            "type": "summary",
            "online": agent_manager.is_online,
            "latency_ms": round(agent_manager.latency_ms, 1),
            "agent": agent_manager.agent_info if agent_manager.is_online else {},
            "telemetry": agent_manager.latest_telemetry if agent_manager.is_online else {}
        }
        await websocket.send_text(json.dumps(init_summary))

        while True:
            # Wait for telemetry or heartbeat broadcast
            try:
                telemetry = await asyncio.wait_for(q.get(), timeout=5.0)
                await websocket.send_text(json.dumps({
                    "type": "telemetry",
                    "online": agent_manager.is_online,
                    "latency_ms": round(agent_manager.latency_ms, 1),
                    "telemetry": telemetry,
                    "timestamp": time.time()
                }))
            except asyncio.TimeoutError:
                # Send ping/keepalive with current online status
                await websocket.send_text(json.dumps({
                    "type": "ping",
                    "online": agent_manager.is_online,
                    "latency_ms": round(agent_manager.latency_ms, 1),
                    "timestamp": time.time()
                }))

    except WebSocketDisconnect:
        pass
    finally:
        agent_manager.unsubscribe_telemetry(q)
