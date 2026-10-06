import os
import re
import json
import logging
from pathlib import Path
from fastapi import FastAPI, Request, WebSocket, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from backend.config import HOST, PORT, LOG_LEVEL, STATIC_DIR, AGENT_AUTH_TOKEN
from backend.routes import (
    auth_routes,
    dashboard_routes,
    terminal_routes,
    file_routes,
    process_routes,
    service_routes,
    gpu_routes,
    storage_routes,
    network_routes,
    job_routes,
    log_routes,
    container_routes,
    system_routes,
    audit_routes,
    llm_routes,
    openai_routes,
    agent_ws
)
from backend.agent_manager import agent_manager

logging.basicConfig(level=getattr(logging, LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("control_plane")

app = FastAPI(
    title="Cloud PC Control Plane",
    description="Professional Browser-Based Remote Management & Monitoring Platform",
    version="1.0.0"
)

# CORS configuration for Vite dev server and local access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(terminal_routes.router)
app.include_router(file_routes.router)
app.include_router(process_routes.router)
app.include_router(service_routes.router)
app.include_router(gpu_routes.router)
app.include_router(storage_routes.router)
app.include_router(network_routes.router)
app.include_router(job_routes.router)
app.include_router(log_routes.router)
app.include_router(container_routes.router)
app.include_router(system_routes.router)
app.include_router(audit_routes.router)
app.include_router(llm_routes.router)
app.include_router(openai_routes.router)
app.include_router(agent_ws.router)

@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "cloud-pc-control",
        "agent_connected": agent_manager.is_online,
        "latency_ms": round(agent_manager.latency_ms, 1)
    }

def get_active_tunnel_urls(request: Request):
    runtime_file = Path(__file__).resolve().parent.parent / "tunnel_runtime.json"
    https_url = None
    wss_url = None
    if runtime_file.is_file():
        try:
            with open(runtime_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                https_url = data.get("public_https_url")
                wss_url = data.get("agent_wss_url")
        except Exception:
            pass

    if not https_url:
        host = request.headers.get("host", f"{HOST}:{PORT}")
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        https_url = f"{proto}://{host}"
        ws_proto = "wss" if proto == "https" else "ws"
        wss_url = f"{ws_proto}://{host}/ws/agent"

    return https_url.rstrip("/"), wss_url

@app.get("/agent.py")
async def get_agent_script(request: Request):
    agent_file = Path(__file__).resolve().parent.parent / "agent" / "molab_single_cell_complete.py"
    if not agent_file.is_file():
        agent_file = STATIC_DIR / "agent.py"
    
    with open(agent_file, "r", encoding="utf-8") as f:
        content = f.read()

    https_url, wss_url = get_active_tunnel_urls(request)
    
    # Dynamically inject the active live WSS URL and agent token
    content = re.sub(
        r'MOLAB_CONTROL_WSS_URL\s*=\s*"[^"]*"',
        f'MOLAB_CONTROL_WSS_URL = "{wss_url}"',
        content
    )
    content = re.sub(
        r'MOLAB_AGENT_AUTH_TOKEN\s*=\s*"[^"]*"',
        f'MOLAB_AGENT_AUTH_TOKEN = "{AGENT_AUTH_TOKEN}"',
        content
    )
    return Response(content=content, media_type="text/x-python")

@app.get("/agent.sh")
async def get_agent_installer_script(request: Request):
    https_url, _ = get_active_tunnel_urls(request)
    script = f"""#!/usr/bin/env bash
set -e
echo "================================================="
echo "   MOLAB CLOUD PC AGENT AUTONOMOUS INSTALLER    "
echo "================================================="
pkill -9 -f agent.py 2>/dev/null || true
python3 -m pip install -q --no-cache-dir websockets psutil 2>/dev/null || true
echo "[*] Downloading latest agent from {https_url}..."
curl -fsSL "{https_url}/agent.py" -o agent.py
if [ ! -s agent.py ]; then
    echo "[ERROR] Failed to download agent.py from {https_url}"
    exit 1
fi
nohup python3 agent.py > agent.log 2>&1 &
sleep 2
if pgrep -f "agent.py" > /dev/null; then
    echo "[OK] MoLab Cloud PC Agent is running in the background (PID $(pgrep -f agent.py | head -n 1))."
    echo "[OK] Connected to Control Plane at {https_url}"
    echo "================================================="
else
    echo "[ERROR] Agent failed to start. Last log entries from agent.log:"
    tail -n 25 agent.log 2>/dev/null || true
    echo "================================================="
fi
"""
    return Response(content=script, media_type="text/x-sh")

@app.websocket("/ws/terminal/{session_id}")
async def direct_ws_terminal(websocket: WebSocket, session_id: str):
    from backend.routes.terminal_routes import terminal_websocket
    await terminal_websocket(websocket, session_id)

# Mount static frontend if available
if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=HOST, port=PORT, reload=False)
