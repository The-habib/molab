#!/usr/bin/env python3
"""
Cloud PC Control Plane - Global Autonomous CLI
Usage:
    cloudpc [start]     Start the control plane background daemon and display MoLab command
    cloudpc status      Check daemon, tunnel, and MoLab pod connection status
    cloudpc stop        Stop the background control plane daemon
    cloudpc restart     Restart background daemon and tunnel
    cloudpc molab       Display and auto-copy the single MoLab terminal command
    cloudpc open        Open the web dashboard in the default browser
    cloudpc logs        Tail recent backend and tunnel logs
    cloudpc setup       Verify environment, install dependencies, and register PATH
"""

import os
import sys
import time
import json
import signal
import shutil
import urllib.request
import urllib.error
import subprocess
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DAEMON_FILE = DATA_DIR / "daemon_runtime.json"
TUNNEL_FILE = BASE_DIR / "tunnel_runtime.json"
VENV_PYTHON = BASE_DIR / ".venv" / "Scripts" / "python.exe"

PYTHON_EXE = str(VENV_PYTHON) if VENV_PYTHON.is_file() else sys.executable

def copy_to_clipboard(text: str) -> bool:
    """Copies text to the Windows system clipboard."""
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value @'\n{text}\n'@"],
            capture_output=True,
            timeout=3
        )
        return True
    except Exception:
        return False

def is_backend_healthy() -> bool:
    try:
        with urllib.request.urlopen("http://127.0.0.1:8800/health", timeout=1.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("status") == "ok"
    except Exception:
        return False
    return False

def get_health_data():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8800/health", timeout=1.5) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        pass
    return None

def is_tunnel_healthy() -> bool:
    if not TUNNEL_FILE.is_file():
        return False
    try:
        if sys.platform == "win32":
            output = subprocess.check_output('tasklist /FI "IMAGENAME eq cloudflared.exe" /NH', shell=True).decode()
            return "cloudflared.exe" in output
        else:
            output = subprocess.check_output(["pgrep", "-f", "cloudflared"]).decode()
            return bool(output.strip())
    except Exception:
        return False

def get_active_tunnel_url():
    if not is_tunnel_healthy():
        if TUNNEL_FILE.is_file():
            try:
                TUNNEL_FILE.unlink()
            except Exception:
                pass
        return None
    try:
        with open(TUNNEL_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("public_https_url")
    except Exception:
        return None

def get_agent_token():
    env_file = BASE_DIR / ".env"
    if env_file.is_file():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("AGENT_AUTH_TOKEN="):
                    return line.split("=", 1)[1]
    return "773d982d1f9faa8f2dc4d3ff7746f5ffe5b23f451845f8b40646238bd5f1379c"

def get_molab_command():
    t_url = get_active_tunnel_url()
    if t_url:
        return f"curl -fsSL {t_url}/agent.sh | bash"
    return "curl -fsSL http://127.0.0.1:8800/agent.sh | bash"

def get_molab_full_command():
    t_url = get_active_tunnel_url()
    base_https = t_url or "http://127.0.0.1:8800"
    clean_host = base_https.replace("https://", "").replace("http://", "").rstrip("/")
    ws_proto = "wss" if "https://" in base_https else "ws"
    base_wss = f"{ws_proto}://{clean_host}/ws/agent"
    token = get_agent_token()

    return (
        f'python3 -m pip install -q --no-cache-dir websockets psutil && '
        f'curl -fsSL "{base_https}/agent.py" -o agent.py && '
        f'test -s agent.py && '
        f'(pkill -9 -f agent.py 2>/dev/null || true) && '
        f'nohup python3 agent.py --wss "{base_wss}" --token "{token}" > agent.log 2>&1 & '
        f'sleep 2 && (pgrep -f agent.py >/dev/null && echo "[OK] Connected to Cloud PC!" || (echo "[ERROR] Agent failed to start. Last log entries:" && cat agent.log))'
    )

def get_admin_credentials():
    env_file = BASE_DIR / ".env"
    username = "admin"
    password = ""
    if env_file.is_file():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("ADMIN_USERNAME="):
                    username = line.split("=", 1)[1]
                elif line.startswith("ADMIN_PASSWORD="):
                    password = line.split("=", 1)[1]
    return username, password

def cmd_setup():
    """Ensures dependencies and PATH are installed."""
    print("=" * 65)
    print("  CLOUD PC CONTROL PLANE - SYSTEM SETUP & VERIFICATION")
    print("=" * 65)

    # 1. Virtual environment
    if not (BASE_DIR / ".venv").is_dir():
        print("[*] Creating Python virtual environment in .venv...")
        subprocess.check_call([sys.executable, "-m", "venv", str(BASE_DIR / ".venv")])
        print("  [OK] Virtual environment created.")
    else:
        print("  [OK] Virtual environment verified.")

    # 2. Dependencies
    print("[*] Checking backend dependencies...")
    subprocess.check_call([PYTHON_EXE, "-m", "pip", "install", "-q", "-r", str(BASE_DIR / "requirements.txt")])
    print("  [OK] Backend dependencies verified.")

    # 3. Frontend distribution
    dist_index = BASE_DIR / "frontend" / "dist" / "index.html"
    if not dist_index.is_file():
        print("[*] Compiling frontend production bundle...")
        npm_cmd = shutil.which("npm.cmd") or shutil.which("npm")
        if npm_cmd:
            subprocess.check_call([npm_cmd, "run", "build"], cwd=str(BASE_DIR / "frontend"))
            print("  [OK] Frontend compiled successfully.")
    else:
        print("  [OK] Frontend assets verified.")

    # 4. PATH Registration
    register_path()
    print("=" * 65)
    print("Setup complete! You can now run 'cloudpc' or 'molab' anywhere.")

def register_path():
    """Registers C:\\cloud-pc-control\\bin and WindowsApps wrappers."""
    bin_dir = BASE_DIR / "bin"
    bin_dir.mkdir(exist_ok=True)

    # Write wrapper scripts
    cloudpc_cmd = bin_dir / "cloudpc.cmd"
    with open(cloudpc_cmd, "w", encoding="utf-8") as f:
        f.write(f'@echo off\n"{PYTHON_EXE}" "{BASE_DIR / "cli.py"}" %*\n')

    molab_cmd = bin_dir / "molab.cmd"
    with open(molab_cmd, "w", encoding="utf-8") as f:
        f.write(f'@echo off\n"{PYTHON_EXE}" "{BASE_DIR / "cli.py"}" %*\n')

    # Copy to AppData Local Microsoft WindowsApps (already in user PATH)
    windows_apps = Path(os.path.expanduser(r"~\AppData\Local\Microsoft\WindowsApps"))
    if windows_apps.is_dir():
        try:
            shutil.copy2(cloudpc_cmd, windows_apps / "cloudpc.cmd")
            shutil.copy2(molab_cmd, windows_apps / "molab.cmd")
            print("  [OK] Global commands 'cloudpc' and 'molab' installed into WindowsApps PATH.")
        except Exception as e:
            print(f"  [WARN] Could not copy to WindowsApps: {e}")

    # Add bin_dir to persistent User PATH
    try:
        ps_cmd = f'''
        $curr = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $target = "{str(bin_dir)}"
        if ($curr -notlike "*$target*") {{
            [System.Environment]::SetEnvironmentVariable("Path", "$curr;$target", "User")
        }}
        '''
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=5)
        print("  [OK] Added C:\\cloud-pc-control\\bin to permanent User PATH.")
    except Exception as e:
        print(f"  [WARN] PATH registry update: {e}")

def cmd_start(foreground=False):
    """Starts the control plane daemon and Cloudflare tunnel."""
    backend_ok = is_backend_healthy()
    tunnel_ok = is_tunnel_healthy()

    if backend_ok and tunnel_ok:
        print("[*] Cloud PC Control Plane and Tunnel are already running!")
        cmd_status()
        return

    from tunnel.tunnel_manager import tunnel_manager

    if backend_ok and not tunnel_ok:
        print("[*] Control Plane backend is active on http://127.0.0.1:8800.")
        print("[*] Launching Cloudflare Quick Tunnel for remote pod access...", flush=True)
        try:
            tunnel_manager.start_tunnel(timeout=30.0)
            print("  [OK] Cloudflare Tunnel established successfully!")
        except Exception as e:
            print(f"  [ERROR] Tunnel start failed: {e}")
        cmd_status()
        return

    print("=" * 70)
    print("       STARTING CLOUD PC CONTROL PLANE AUTONOMOUS DAEMON")
    print("=" * 70)

    runner_script = BASE_DIR / "run_control_plane.py"

    if foreground:
        subprocess.run([PYTHON_EXE, "-u", str(runner_script)], cwd=str(BASE_DIR))
        return

    # Start detached daemon process
    DETACHED = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    proc = subprocess.Popen(
        [PYTHON_EXE, "-u", str(runner_script)],
        cwd=str(BASE_DIR),
        creationflags=DETACHED,
        close_fds=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    print(f"[*] Control Plane daemon launched (PID {proc.pid}). Waiting for endpoints...", flush=True)

    # Wait for backend health
    healthy = False
    for _ in range(25):
        if is_backend_healthy():
            healthy = True
            break
        time.sleep(0.5)

    if not healthy:
        print("[ERROR] Daemon failed to become healthy within timeout. Try 'cloudpc start --foreground'.")
        sys.exit(1)

    # Wait for Cloudflare tunnel URL
    tunnel_url = None
    for _ in range(30):
        tunnel_url = get_active_tunnel_url()
        if tunnel_url:
            break
        time.sleep(0.5)

    cmd_status()

    # Open dashboard
    try:
        webbrowser.open("http://127.0.0.1:8800")
    except Exception:
        pass

def cmd_status():
    """Displays comprehensive status and the single MoLab terminal command."""
    healthy = is_backend_healthy()
    health_data = get_health_data() if healthy else None
    tunnel_url = get_active_tunnel_url()
    username, password = get_admin_credentials()
    molab_full = get_molab_full_command()
    molab_short = get_molab_command()

    pod_online = health_data.get("agent_connected", False) if health_data else False
    latency = health_data.get("latency_ms", 0.0) if health_data else 0.0

    print("\n" + "=" * 76)
    print("                 CLOUD PC CONTROL PLANE - STATUS")
    print("=" * 76)
    print(f"  CONTROL PLANE  : {'ONLINE  (http://127.0.0.1:8800)' if healthy else 'OFFLINE (Run: cloudpc start)'}")
    print(f"  TUNNEL ENDPOINT: {tunnel_url or 'Initializing / Local mode'}")
    print(f"  REMOTE POD     : {'LINKED  (Latency: ' + str(latency) + ' ms)' if pod_online else 'WAITING FOR POD LINK'}")
    print(f"  CREDENTIALS    : Username: {username}  |  Password: {password}")
    print("-" * 76)

    if not pod_online:
        print("  >>> RUN THIS COMPLETE COMMAND IN YOUR MOLAB LINUX TERMINAL (A TO Z) <<<")
        print("")
        print(f"    {molab_full}")
        print("")
        copied = copy_to_clipboard(molab_full)
        if copied:
            print("  [COPIED TO CLIPBOARD!] Press Ctrl+V in your MoLab terminal and hit Enter.")
        else:
            print("  (Paste into your MoLab terminal. Contains all credentials and WSS URLs!)")
        print("")
        print("  --- Alternatively, use the short installer: ---")
        print(f"    {molab_short}")
    else:
        print("  [OK] MoLab NVIDIA RTX PRO 6000 Blackwell Pod is fully linked and streaming telemetry!")
        print("  Open Dashboard: http://127.0.0.1:8800")

    print("=" * 76 + "\n")

def cmd_connect():
    """Outputs the A-to-Z connection command and watches live for the connection."""
    cmd_status()
    if is_backend_healthy():
        health = get_health_data()
        if health and health.get("agent_connected"):
            print("[OK] Remote pod is already connected!")
            return
        print("[*] Waiting for MoLab pod to connect (watching live)... Press Ctrl+C to cancel.")
        try:
            while True:
                time.sleep(1.0)
                h = get_health_data()
                if h and h.get("agent_connected"):
                    print(f"\n[OK] POD LINKED SUCCESSFULLY! (Latency: {h.get('latency_ms', 0)} ms)")
                    print("Open Dashboard: http://127.0.0.1:8800")
                    break
        except KeyboardInterrupt:
            print("\nWatch cancelled.")

def cmd_stop():
    """Stops the control plane daemon and tunnel."""
    pids_file = BASE_DIR / ".control_plane_pids.json"
    stopped = False

    if pids_file.is_file():
        try:
            with open(pids_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                b_pid = data.get("backend_pid")
                t_pid = data.get("tunnel_pid")
                if b_pid:
                    try:
                        os.kill(b_pid, signal.SIGTERM)
                    except Exception:
                        pass
                if t_pid:
                    try:
                        os.kill(t_pid, signal.SIGTERM)
                    except Exception:
                        pass
                stopped = True
        except Exception:
            pass
        try:
            pids_file.unlink()
        except Exception:
            pass

    # Fallback: kill processes on port 8800
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command", "Get-NetTCPConnection -LocalPort 8800 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"],
            capture_output=True,
            timeout=5
        )
        stopped = True
    except Exception:
        pass

    # Terminate cloudflared process
    try:
        if sys.platform == "win32":
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", "Get-Process -Name '*cloudflared*' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"],
                capture_output=True,
                timeout=5
            )
        else:
            subprocess.run(["pkill", "-9", "-f", "cloudflared"], capture_output=True, timeout=5)
    except Exception:
        pass

    if TUNNEL_FILE.is_file():
        try:
            TUNNEL_FILE.unlink()
        except Exception:
            pass

    print("[OK] Cloud PC Control Plane daemon and tunnel stopped.")

def cmd_restart():
    cmd_stop()
    time.sleep(1.5)
    cmd_start()

def cmd_molab(short=False):
    """Prints and copies the MoLab terminal command."""
    molab_cmd = get_molab_command() if short else get_molab_full_command()
    print(molab_cmd)
    if copy_to_clipboard(molab_cmd):
        print("\n[OK] Copied to clipboard! Just paste into MoLab terminal and press Enter.", file=sys.stderr)

def cmd_open():
    webbrowser.open("http://127.0.0.1:8800")
    print("[OK] Dashboard opened in browser (http://127.0.0.1:8800).")

def print_help():
    print("""
Cloud PC Control Plane - Autonomous CLI

Commands:
    cloudpc               Start control plane daemon & show status (Default)
    cloudpc connect       Show A-to-Z command and watch live for connection
    cloudpc start         Start control plane background daemon
    cloudpc start -f      Start in foreground mode
    cloudpc status        Show live status, tunnel URL, and MoLab command
    cloudpc stop          Stop background daemon and tunnel
    cloudpc restart       Restart daemon and tunnel
    cloudpc molab         Print and copy the complete A-to-Z MoLab terminal command
    cloudpc molab --short Print and copy the short installer command
    cloudpc open          Open web dashboard in browser
    cloudpc setup         Verify requirements and register PATH commands
    cloudpc help          Show this help message
""")

def main():
    args = sys.argv[1:]
    if not args:
        if is_backend_healthy():
            cmd_status()
        else:
            cmd_start()
        return

    cmd = args[0].lower().strip("-")
    if cmd in ["start"]:
        fg = "-f" in args or "--foreground" in args
        cmd_start(foreground=fg)
    elif cmd in ["connect", "watch"]:
        cmd_connect()
    elif cmd in ["status", "info"]:
        cmd_status()
    elif cmd in ["stop", "kill", "down"]:
        cmd_stop()
    elif cmd in ["restart"]:
        cmd_restart()
    elif cmd in ["molab", "link", "cmd", "command"]:
        short = "--short" in args or "-s" in args
        cmd_molab(short=short)
    elif cmd in ["open", "browse", "ui", "dash", "dashboard"]:
        cmd_open()
    elif cmd in ["setup", "install", "init"]:
        cmd_setup()
    elif cmd in ["help", "h"]:
        print_help()
    else:
        print(f"Unknown command: {args[0]}")
        print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
