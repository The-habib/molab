import os
import sys
import time
import json
import signal
import subprocess
import threading
import webbrowser
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

def ensure_environment():
    """Verify essential packages are installed, auto-installing if needed."""
    try:
        import fastapi
        import uvicorn
        import websockets
    except ImportError:
        print("[*] Installing required backend packages (first-time setup)...", flush=True)
        req_file = BASE_DIR / "requirements.txt"
        if req_file.exists():
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "-r", str(req_file)])
        else:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "fastapi", "uvicorn", "websockets", "httpx", "python-dotenv", "pydantic"])
        print("  [OK] Dependencies installed successfully.", flush=True)

def main():
    ensure_environment()

    from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD, AGENT_AUTH_TOKEN
    from tunnel.tunnel_manager import tunnel_manager

    print("=" * 72, flush=True)
    print("       CLOUD PC CONTROL PLANE - AUTONOMOUS ZERO-TOUCH LAUNCHER     ", flush=True)
    print("=" * 72, flush=True)

    # 1. Start FastAPI backend
    print("\n[1/3] Starting Control Plane Backend on http://127.0.0.1:8800...", flush=True)
    backend_cmd = [
        sys.executable,
        "-u",
        "-m", "uvicorn",
        "backend.main:app",
        "--host", "127.0.0.1",
        "--port", "8800",
        "--log-level", "warning"
    ]
    backend_proc = subprocess.Popen(backend_cmd, cwd=str(BASE_DIR))

    # Wait for backend health
    healthy = False
    for _ in range(15):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8800/health", timeout=1) as resp:
                if resp.status == 200:
                    healthy = True
                    break
        except Exception:
            time.sleep(0.5)

    if not healthy:
        print("[ERROR] Backend failed to start on port 8800.", flush=True)
        backend_proc.terminate()
        sys.exit(1)

    print("  [OK] Backend healthy on http://127.0.0.1:8800", flush=True)

    # 2. Start Cloudflare Quick Tunnel
    print("\n[2/3] Starting Cloudflare Quick Tunnel for remote MoLab pod link...", flush=True)
    tunnel_info = None
    try:
        tunnel_info = tunnel_manager.start_tunnel(timeout=30.0)
    except Exception as e:
        print(f"  [WARN] Cloudflare tunnel initialization failed ({e}). Running in local mode only.", flush=True)

    # 3. Determine single MoLab command
    public_url = tunnel_info.get("public_https_url") if tunnel_info else "http://127.0.0.1:8800"
    clean_host = public_url.replace("https://", "").replace("http://", "").rstrip("/")
    ws_proto = "wss" if "https://" in public_url else "ws"
    base_wss = f"{ws_proto}://{clean_host}/ws/agent"

    molab_full_cmd = (
        f'python3 -m pip install -q --no-cache-dir websockets psutil && '
        f'curl -fsSL "{public_url}/agent.py" -o agent.py && '
        f'test -s agent.py && '
        f'(pkill -9 -f agent.py 2>/dev/null || true) && '
        f'nohup python3 agent.py --wss "{base_wss}" --token "{AGENT_AUTH_TOKEN}" > agent.log 2>&1 & '
        f'sleep 2 && (pgrep -f agent.py >/dev/null && echo "[OK] Connected to Cloud PC!" || (echo "[ERROR] Agent failed to start. Last log entries:" && cat agent.log))'
    )
    molab_terminal_cmd = f"curl -fsSL {public_url}/agent.sh | bash"

    print("\n[3/3] Control Plane is Ready!", flush=True)
    print("=" * 76, flush=True)
    print(f"  LOCAL DASHBOARD : http://127.0.0.1:8800", flush=True)
    print(f"  ADMIN USERNAME  : {ADMIN_USERNAME}", flush=True)
    print(f"  ADMIN PASSWORD  : {ADMIN_PASSWORD}", flush=True)
    print("-" * 76, flush=True)
    print("  >>> RUN THIS COMPLETE COMMAND IN YOUR MOLAB LINUX TERMINAL (A TO Z) <<<", flush=True)
    print("", flush=True)
    print(f"    {molab_full_cmd}", flush=True)
    print("", flush=True)
    print("  --- Alternatively, use the short installer: ---", flush=True)
    print(f"    {molab_terminal_cmd}", flush=True)
    print("=" * 76, flush=True)
    print("Opening browser dashboard... Press Ctrl+C to stop.\n", flush=True)

    # Auto-open browser in background thread
    def open_browser():
        time.sleep(1.2)
        try:
            webbrowser.open("http://127.0.0.1:8800")
        except Exception:
            pass

    threading.Thread(target=open_browser, daemon=True).start()

    # Save PIDs for stop script
    pid_data = {
        "backend_pid": backend_proc.pid,
        "tunnel_pid": tunnel_manager.process.pid if tunnel_manager.process else None,
        "started_at": time.time()
    }
    with open(BASE_DIR / ".control_plane_pids.json", "w", encoding="utf-8") as f:
        json.dump(pid_data, f, indent=2)

    def shutdown(sig, frame):
        print("\nShutting down Control Plane backend...")
        backend_proc.terminate()
        # Keep cloudflare tunnel running so remote pods never lose connectivity across restarts
        pids_file = BASE_DIR / ".control_plane_pids.json"
        if pids_file.exists():
            try:
                pids_file.unlink()
            except Exception:
                pass
        print("Control plane stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Monitor loop
    try:
        while True:
            if backend_proc.poll() is not None:
                print("[ERROR] Backend process terminated unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown(None, None)

if __name__ == "__main__":
    main()
