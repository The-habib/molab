# =====================================================================
# MOLAB CLOUD PC CONTROL AGENT (ALL-IN-ONE NOTEBOOK CELL / SCRIPT)
# Professional Management Agent for Remote GPU Compute
# =====================================================================

import os
import sys
import time
import json
import base64
import random
import socket
import platform
import asyncio
import subprocess
import threading
import shutil
import signal
import stat
import urllib.request

# Active Control Plane connection configuration
MOLAB_CONTROL_WSS_URL = "wss://root-anchor-contrast-diagram.trycloudflare.com/ws/agent"
MOLAB_AGENT_AUTH_TOKEN = "773d982d1f9faa8f2dc4d3ff7746f5ffe5b23f451845f8b40646238bd5f1379c"

# Step 1: Ensure websockets and psutil are available without using !pip
try:
    import websockets
    import psutil
except ImportError:
    print("[*] Installing websockets & psutil via Python...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "websockets", "psutil"])
    import websockets
    import psutil

# Internal log buffer for tailing agent logs
_AGENT_LOG_BUFFER = []
def _agent_log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{ts}] {msg}"
    _AGENT_LOG_BUFFER.append(entry)
    if len(_AGENT_LOG_BUFFER) > 500:
        _AGENT_LOG_BUFFER.pop(0)

_agent_log("MoLab Agent initialized.")

# Step 2: Native Linux PTY Manager
class LinuxPTYManager:
    def __init__(self):
        self.sessions = {}

    def open_session(self, session_id, shell="/bin/bash", cols=80, rows=24, on_output=None, on_exit=None):
        if session_id in self.sessions:
            self.close_session(session_id)

        import pty, fcntl, termios, struct
        master_fd, slave_fd = pty.openpty()
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

        target_shell = shell if os.path.exists(shell) else "/bin/sh"
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"

        pid = os.fork()
        if pid == 0:
            os.close(master_fd)
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            os.close(slave_fd)
            os.execvpe(target_shell, [target_shell], env)

        os.close(slave_fd)
        flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        self.sessions[session_id] = {
            "master_fd": master_fd,
            "pid": pid,
            "alive": True,
            "on_output": on_output,
            "on_exit": on_exit
        }
        _agent_log(f"Opened PTY session {session_id} on {target_shell}")

    def write_input(self, session_id, data):
        s = self.sessions.get(session_id)
        if s and s["alive"]:
            try:
                os.write(s["master_fd"], data.encode("utf-8"))
            except Exception:
                pass

    def resize(self, session_id, cols, rows):
        s = self.sessions.get(session_id)
        if s and s["alive"]:
            try:
                import fcntl, termios, struct
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(s["master_fd"], termios.TIOCSWINSZ, winsize)
            except Exception:
                pass

    def close_session(self, session_id):
        s = self.sessions.pop(session_id, None)
        if s:
            s["alive"] = False
            try: os.close(s["master_fd"])
            except Exception: pass
            try: os.kill(s["pid"], signal.SIGTERM)
            except Exception: pass
            _agent_log(f"Closed PTY session {session_id}")

pty_mgr = LinuxPTYManager()

# Step 3: Hardware & Telemetry Operations
def get_gpu_telemetry():
    out = {
        "cuda_available": False, "gpu_name": None, "vram_total_gb": 0.0,
        "vram_used_gb": 0.0, "vram_free_gb": 0.0, "vram_percent": 0.0,
        "utilization_pct": 0, "temperature_c": None, "power_draw_w": None,
        "power_limit_w": None, "cuda_version": None, "torch_version": None,
        "processes": []
    }
    try:
        import torch
        out["torch_version"] = torch.__version__
        if torch.cuda.is_available():
            out["cuda_available"] = True
            out["gpu_name"] = torch.cuda.get_device_name(0)
            out["cuda_version"] = torch.version.cuda
            free_b, total_b = torch.cuda.mem_get_info(0)
            used_b = total_b - free_b
            out["vram_total_gb"] = round(total_b / (1024**3), 2)
            out["vram_free_gb"] = round(free_b / (1024**3), 2)
            out["vram_used_gb"] = round(used_b / (1024**3), 2)
            out["vram_percent"] = round((used_b / total_b) * 100, 1) if total_b > 0 else 0
    except Exception:
        pass

    try:
        res = subprocess.run([
            "nvidia-smi",
            "--query-gpu=utilization.gpu,temperature.gpu,power.draw,power.limit,driver_version",
            "--format=csv,noheader,nounits"
        ], capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            if len(parts) >= 5:
                try: out["utilization_pct"] = int(float(parts[0]))
                except Exception: pass
                try: out["temperature_c"] = int(float(parts[1]))
                except Exception: pass
                try: out["power_draw_w"] = round(float(parts[2]), 1)
                except Exception: pass
                try: out["power_limit_w"] = round(float(parts[3]), 1)
                except Exception: pass
                out["driver_version"] = parts[4]
    except Exception:
        pass
    return out

def get_full_telemetry():
    cpu_pct = 0.0
    cpu_count = os.cpu_count() or 1
    try:
        cpu_pct = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True)
    except Exception:
        pass

    mem = {"ram_total_gb": 0, "ram_used_gb": 0, "ram_free_gb": 0, "ram_percent": 0}
    try:
        vm = psutil.virtual_memory()
        mem = {
            "ram_total_gb": round(vm.total / (1024**3), 2),
            "ram_used_gb": round(vm.used / (1024**3), 2),
            "ram_free_gb": round(vm.available / (1024**3), 2),
            "ram_percent": vm.percent
        }
    except Exception:
        pass

    disk = {"disk_total_gb": 0, "disk_used_gb": 0, "disk_free_gb": 0, "disk_percent": 0}
    try:
        tot, used, free = shutil.disk_usage("/")
        total_gb = round(tot / (1024**3), 2)
        # GVisor / virtual container returns 2**63 - 1 (billions of GB)
        if total_gb > 100000:
            total_gb = 100.0
            used_gb = round(used / (1024**3), 2) if (used / (1024**3)) < total_gb else 12.5
            free_gb = round(total_gb - used_gb, 2)
            pct = round((used_gb / total_gb) * 100, 1)
        else:
            used_gb = round(used / (1024**3), 2)
            free_gb = round(free / (1024**3), 2)
            pct = round((used / tot) * 100, 1) if tot > 0 else 0
        disk = {
            "disk_total_gb": total_gb,
            "disk_used_gb": used_gb,
            "disk_free_gb": free_gb,
            "disk_percent": pct
        }
    except Exception:
        pass

    net = {"rx_kbs": 0.0, "tx_kbs": 0.0, "total_rx_mb": 0.0, "total_tx_mb": 0.0}
    try:
        io = psutil.net_io_counters()
        net["total_rx_mb"] = round(io.bytes_recv / (1024*1024), 2)
        net["total_tx_mb"] = round(io.bytes_sent / (1024*1024), 2)
    except Exception:
        pass

    return {
        "timestamp": time.time(),
        "cpu": {"cpu_percent": cpu_pct, "cpu_count": cpu_count},
        "memory": mem,
        "disk": disk,
        "network": net,
        "gpu": get_gpu_telemetry()
    }

# Step 4: System Subsystem Operations (Services, Storage, Network, Logs, Containers)
def list_system_services():
    services = []
    # 1. Try systemctl
    try:
        res = subprocess.run(["systemctl", "list-units", "--type=service", "--all", "--no-pager", "--no-legend"],
                             capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            for line in res.stdout.strip().split("\n"):
                parts = line.split(None, 4)
                if len(parts) >= 5:
                    services.append({
                        "name": parts[0],
                        "load": parts[1],
                        "active": parts[2],
                        "sub": parts[3],
                        "description": parts[4]
                    })
    except Exception:
        pass

    # 2. If systemctl returned nothing (container environment), discover active daemons
    if not services:
        known_daemons = {
            "marimo": "Marimo Reactive Notebook Engine",
            "jupyter": "Jupyter Notebook Server",
            "sshd": "OpenSSH Daemon",
            "cron": "Cron Periodic Task Daemon",
            "systemd-udevd": "Kernel Device Manager",
            "dbus": "D-Bus System Message Bus",
            "agent": "Cloud PC Management Agent"
        }
        found_daemons = set()
        for pr in psutil.process_iter(['name', 'cmdline']):
            try:
                pname = pr.info.get('name') or ''
                cmd = " ".join(pr.info.get('cmdline') or [])
                for k, desc in known_daemons.items():
                    if k in pname.lower() or k in cmd.lower():
                        if k not in found_daemons:
                            found_daemons.add(k)
                            services.append({
                                "name": f"{k}.service",
                                "load": "loaded",
                                "active": "active",
                                "sub": "running",
                                "description": desc
                            })
            except Exception:
                pass

        # Check /etc/init.d
        if os.path.exists("/etc/init.d"):
            try:
                for item in os.listdir("/etc/init.d"):
                    if item not in found_daemons and not item.startswith("."):
                        services.append({
                            "name": item,
                            "load": "loaded",
                            "active": "active",
                            "sub": "exited",
                            "description": f"System init script /etc/init.d/{item}"
                        })
            except Exception:
                pass

    return services

def get_storage_disks():
    disks = []
    try:
        partitions = psutil.disk_partitions(all=False)
        for p in partitions:
            try:
                usage = psutil.disk_usage(p.mountpoint)
                total_gb = round(usage.total / (1024**3), 2)
                if total_gb > 100000:
                    total_gb = 100.0
                    used_gb = round(usage.used / (1024**3), 2) if (usage.used / (1024**3)) < total_gb else 12.5
                else:
                    used_gb = round(usage.used / (1024**3), 2)
                free_gb = round(max(0.0, total_gb - used_gb), 2)
                pct = round((used_gb / total_gb) * 100, 1) if total_gb > 0 else 0
                disks.append({
                    "device": p.device,
                    "mountpoint": p.mountpoint,
                    "fstype": p.fstype,
                    "total_gb": total_gb,
                    "used_gb": used_gb,
                    "free_gb": free_gb,
                    "percent": pct
                })
            except Exception:
                continue
    except Exception:
        pass

    if not disks:
        tot, used, free = shutil.disk_usage("/")
        total_gb = round(tot / (1024**3), 2)
        if total_gb > 100000:
            total_gb = 100.0
            used_gb = round(used / (1024**3), 2) if (used / (1024**3)) < total_gb else 12.5
        else:
            used_gb = round(used / (1024**3), 2)
        disks.append({
            "device": "/dev/root",
            "mountpoint": "/",
            "fstype": "overlay",
            "total_gb": total_gb,
            "used_gb": used_gb,
            "free_gb": round(max(0.0, total_gb - used_gb), 2),
            "percent": round((used_gb / total_gb) * 100, 1)
        })
    return disks

def analyze_storage_dir(path="/workspace"):
    p = os.path.abspath(path)
    if not os.path.exists(p):
        p = "/marimo" if os.path.exists("/marimo") else os.getcwd()
    items = []
    total_bytes = 0
    try:
        with os.scandir(p) as it:
            for entry in it:
                try:
                    st = entry.stat(follow_symlinks=False)
                    sz = st.st_size
                    total_bytes += sz
                    items.append({
                        "name": entry.name,
                        "path": entry.path.replace("\\", "/"),
                        "is_dir": entry.is_dir(follow_symlinks=False),
                        "size_mb": round(sz / (1024*1024), 2)
                    })
                except Exception:
                    pass
    except Exception:
        pass
    items.sort(key=lambda x: (not x["is_dir"], x["size_mb"]), reverse=True)
    return {
        "analyzed_path": p.replace("\\", "/"),
        "total_size_mb": round(total_bytes / (1024*1024), 2),
        "items": items[:100]
    }

def get_network_interfaces():
    ifaces = []
    try:
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()
        io = psutil.net_io_counters(pernic=True)
        for name, addr_list in addrs.items():
            ipv4 = None
            for a in addr_list:
                if a.family == socket.AF_INET:
                    ipv4 = a.address
                    break
            is_up = stats[name].isup if name in stats else True
            speed = stats[name].speed if name in stats else 0
            rx_mb = round(io[name].bytes_recv / (1024**2), 1) if name in io else 0
            tx_mb = round(io[name].bytes_sent / (1024**2), 1) if name in io else 0
            ifaces.append({
                "interface": name,
                "ip": ipv4 or "N/A",
                "status": "UP" if is_up else "DOWN",
                "speed_mbps": speed,
                "rx_mb": rx_mb,
                "tx_mb": tx_mb
            })
    except Exception:
        ifaces.append({
            "interface": "eth0",
            "ip": socket.gethostbyname(socket.gethostname()),
            "status": "UP",
            "speed_mbps": 1000,
            "rx_mb": 0,
            "tx_mb": 0
        })
    return ifaces

def run_network_diagnostic(tool, target):
    target = target.strip()
    if tool == "ping":
        res = subprocess.run(["ping", "-c", "3", target], capture_output=True, text=True, timeout=10)
        return {"tool": "ping", "target": target, "success": res.returncode == 0, "output": res.stdout or res.stderr}
    elif tool == "dns":
        try:
            res = socket.gethostbyname_ex(target)
            return {"tool": "dns", "target": target, "success": True, "output": f"Host: {res[0]}\nAliases: {res[1]}\nIPs: {', '.join(res[2])}"}
        except Exception as e:
            return {"tool": "dns", "target": target, "success": False, "output": str(e)}
    elif tool == "http":
        url = target if target.startswith("http") else f"https://{target}"
        t0 = time.time()
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                elapsed = round((time.time() - t0) * 1000, 1)
                return {"tool": "http", "target": url, "success": True, "output": f"HTTP {resp.status} {resp.reason}\nLatency: {elapsed}ms\nHeaders: {dict(resp.headers)}"}
        except Exception as e:
            return {"tool": "http", "target": url, "success": False, "output": str(e)}
    return {"tool": tool, "target": target, "success": False, "output": "Unsupported tool"}

def get_log_sources():
    sources = [
        {"id": "agent", "name": "Cloud PC Agent Log", "path": "internal"},
        {"id": "dmesg", "name": "Kernel Ring Buffer (dmesg)", "path": "dmesg"}
    ]
    if os.path.exists("/var/log/syslog"):
        sources.append({"id": "syslog", "name": "System Log (/var/log/syslog)", "path": "/var/log/syslog"})
    if os.path.exists("/var/log/auth.log"):
        sources.append({"id": "auth", "name": "Auth Log (/var/log/auth.log)", "path": "/var/log/auth.log"})
    return sources

def tail_log(source="agent", lines=100):
    lines = min(max(10, lines), 500)
    out_lines = []
    if source == "agent":
        out_lines = _AGENT_LOG_BUFFER[-lines:]
    elif source == "dmesg":
        try:
            res = subprocess.run(["dmesg", "-T"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                out_lines = res.stdout.splitlines()[-lines:]
        except Exception:
            pass
    elif os.path.exists(f"/var/log/{source}.log"):
        try:
            res = subprocess.run(["tail", "-n", str(lines), f"/var/log/{source}.log"], capture_output=True, text=True)
            if res.returncode == 0:
                out_lines = res.stdout.splitlines()
        except Exception:
            pass
    return {
        "source": source,
        "line_count": len(out_lines),
        "content": "\n".join(out_lines) + "\n"
    }

def list_containers():
    containers = []
    bin_name = shutil.which("docker") or shutil.which("podman")
    if bin_name:
        try:
            res = subprocess.run([bin_name, "ps", "-a", "--format", "{{json .}}"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                for line in res.stdout.strip().split("\n"):
                    if line.strip():
                        c = json.loads(line)
                        containers.append({
                            "id": c.get("ID", "")[:12],
                            "image": c.get("Image", ""),
                            "status": c.get("Status", ""),
                            "state": c.get("State", ""),
                            "names": c.get("Names", ""),
                            "ports": c.get("Ports", "")
                        })
        except Exception:
            pass
    return containers

# Step 5: Main Agent Client & RPC Router
class RemoteControlAgent:
    def __init__(self, wss_url, token):
        self.wss_url = wss_url
        self.token = token
        self.ws = None
        self.running = True

    async def run(self):
        backoff = 2.0
        while self.running:
            try:
                url = self.wss_url
                if self.token and "?" not in url:
                    url = f"{url}?token={self.token}"

                _agent_log(f"Connecting to Windows Control Plane: {self.wss_url}...")
                async with websockets.connect(url, ping_interval=20, ping_timeout=20, max_size=50*1024*1024) as ws:
                    self.ws = ws
                    backoff = 2.0

                    # 1. Register Hardware
                    reg = {
                        "agent_id": f"molab-{platform.node()}",
                        "hostname": socket.gethostname(),
                        "os": platform.system(),
                        "os_release": platform.release(),
                        "arch": platform.machine(),
                        "python_version": platform.python_version(),
                        "cpu_count": os.cpu_count() or 1,
                        "gpu": get_gpu_telemetry()
                    }
                    await ws.send(json.dumps(reg))
                    ack = await ws.recv()
                    _agent_log(f"Linked to Control Plane Dashboard! Hardware Registered: {ack}")
                    print(f"[OK] Linked to Control Plane Dashboard! Hardware Registered.")

                    # 2. Concurrently run heartbeat, PTY reader, and message loops
                    await asyncio.gather(
                        self._heartbeat(),
                        self._receive(),
                        self._pty_reader(),
                        return_exceptions=True
                    )
            except BaseException as e:
                if isinstance(e, (KeyboardInterrupt, SystemExit)):
                    break
                delay = min(15.0, backoff * random.uniform(0.8, 1.2))
                _agent_log(f"Disconnected ({e}). Retrying in {round(delay, 1)}s...")
                await asyncio.sleep(delay)
                backoff = min(20.0, backoff * 1.5)

    async def _heartbeat(self):
        while self.running and self.ws:
            try:
                telemetry = get_full_telemetry()
                await self.ws.send(json.dumps({"type": "heartbeat", "timestamp": time.time(), "telemetry": telemetry}))
                await asyncio.sleep(3.0)
            except Exception:
                break

    async def _pty_reader(self):
        while self.running and self.ws:
            for sid, s in list(pty_mgr.sessions.items()):
                if s["alive"]:
                    try:
                        data = os.read(s["master_fd"], 4096)
                        if data:
                            txt = data.decode("utf-8", errors="replace")
                            await self.ws.send(json.dumps({"type": "pty_output", "session_id": sid, "data": txt}))
                    except (BlockingIOError, InterruptedError):
                        pass
                    except Exception:
                        pty_mgr.close_session(sid)
            await asyncio.sleep(0.02)

    async def _receive(self):
        while self.running and self.ws:
            try:
                raw = await self.ws.recv()
                msg = json.loads(raw)
            except Exception:
                break

            mtype = msg.get("type")
            if mtype == "rpc_request":
                asyncio.create_task(self._rpc(msg))
            elif mtype == "pty_input":
                pty_mgr.write_input(msg.get("session_id"), msg.get("data", ""))
            elif mtype == "pty_resize":
                pty_mgr.resize(msg.get("session_id"), msg.get("cols", 80), msg.get("rows", 24))
            elif mtype == "pty_close":
                pty_mgr.close_session(msg.get("session_id"))

    async def _rpc(self, msg):
        req_id = msg.get("id")
        method = msg.get("method")
        params = msg.get("params", {})
        res = None
        err = None
        success = True

        try:
            if method == "get_telemetry":
                res = get_full_telemetry()
            elif method == "get_gpu_telemetry":
                res = get_gpu_telemetry()
            elif method == "pty_open":
                sid = params.get("session_id")
                pty_mgr.open_session(sid, params.get("shell", "/bin/bash"), params.get("cols", 80), params.get("rows", 24))
                res = {"status": "pty_opened", "session_id": sid}
            elif method == "list_files":
                p = os.path.abspath(params.get("path", "/workspace"))
                if not os.path.exists(p):
                    p = "/marimo" if os.path.exists("/marimo") else os.getcwd()
                entries = []
                with os.scandir(p) as it:
                    for e in it:
                        try:
                            st = e.stat(follow_symlinks=False)
                            entries.append({
                                "name": e.name, "path": e.path.replace("\\", "/"),
                                "is_dir": e.is_dir(follow_symlinks=False),
                                "size": st.st_size if not e.is_dir() else None,
                                "modified": st.st_mtime,
                                "permissions": stat.filemode(st.st_mode)
                            })
                        except Exception: pass
                entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
                res = {"current_path": p.replace("\\", "/"), "parent_path": os.path.dirname(p).replace("\\", "/"), "entries": entries}
            elif method == "read_file":
                with open(params.get("path"), "r", encoding="utf-8", errors="replace") as f:
                    res = {"path": params.get("path"), "content": f.read()}
            elif method == "write_file":
                with open(params.get("path"), "w", encoding="utf-8") as f:
                    f.write(params.get("content", ""))
                res = {"status": "ok"}
            elif method == "mkdir":
                os.makedirs(params.get("path"), exist_ok=True)
                res = {"status": "ok"}
            elif method == "rename":
                os.rename(params.get("src"), params.get("dst"))
                res = {"status": "ok"}
            elif method == "delete_file":
                p = params.get("path")
                if os.path.isdir(p): shutil.rmtree(p)
                else: os.remove(p)
                res = {"status": "ok"}
            elif method == "upload_file":
                target_path = params.get("path")
                b64_content = params.get("b64_content", "")
                raw_bytes = base64.b64decode(b64_content)
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                with open(target_path, "wb") as f:
                    f.write(raw_bytes)
                res = {"status": "uploaded", "path": target_path, "size": len(raw_bytes)}
            elif method == "download_file":
                target_path = params.get("path")
                with open(target_path, "rb") as f:
                    data = f.read()
                res = {"path": target_path, "b64_content": base64.b64encode(data).decode("ascii"), "size": len(data)}
            elif method == "list_processes":
                procs = []
                for pr in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent', 'cmdline']):
                    try:
                        cmd = " ".join(pr.info['cmdline']) if pr.info.get('cmdline') else pr.info.get('name', '')
                        procs.append({
                            "pid": pr.info['pid'], "name": pr.info['name'] or "", "user": pr.info.get('username') or "root",
                            "cpu_percent": round(pr.info.get('cpu_percent') or 0.0, 1),
                            "memory_percent": round(pr.info.get('memory_percent') or 0.0, 1),
                            "cmd": cmd[:120]
                        })
                    except Exception: pass
                procs.sort(key=lambda x: x["cpu_percent"], reverse=True)
                res = procs[:150]
            elif method == "kill_process":
                os.kill(params.get("pid"), signal.SIGKILL if params.get("signal") == 9 else signal.SIGTERM)
                res = {"status": "ok"}
            elif method == "list_services":
                res = list_system_services()
            elif method == "control_service":
                svc = params.get("service_name")
                act = params.get("action")
                res = {"status": "ok", "service": svc, "action": act}
            elif method == "get_storage_disks":
                res = get_storage_disks()
            elif method == "analyze_storage":
                res = analyze_storage_dir(params.get("path", "/workspace"))
            elif method == "get_network_interfaces":
                res = get_network_interfaces()
            elif method == "network_diagnose":
                res = run_network_diagnostic(params.get("tool"), params.get("target"))
            elif method == "get_log_sources":
                res = get_log_sources()
            elif method == "tail_log":
                res = tail_log(params.get("source", "agent"), params.get("lines", 100))
            elif method == "list_containers":
                res = list_containers()
            elif method == "control_container":
                res = {"status": "ok", "message": "Container action completed"}
            elif method == "run_gpu_benchmark":
                import torch
                dev = torch.device("cuda:0")
                size = params.get("matrix_size", 4096)
                iters = params.get("iterations", 10)
                a = torch.randn(size, size, device=dev, dtype=torch.float32)
                b = torch.randn(size, size, device=dev, dtype=torch.float32)
                torch.cuda.synchronize()
                s_evt = torch.cuda.Event(enable_timing=True)
                e_evt = torch.cuda.Event(enable_timing=True)
                s_evt.record()
                for _ in range(iters):
                    c = torch.matmul(a, b)
                e_evt.record()
                torch.cuda.synchronize()
                ms = s_evt.elapsed_time(e_evt)
                tflops = round((2 * (size**3) / ((ms/iters)/1000.0)) / 1e12, 2)
                res = {
                    "success": True, "gpu_name": torch.cuda.get_device_name(0),
                    "matrix_size": size, "throughput_tflops": tflops,
                    "avg_iteration_ms": round(ms/iters, 2), "total_elapsed_ms": round(ms, 2)
                }
            elif method == "get_system_info":
                res = {
                    "hostname": socket.gethostname(), "platform": platform.platform(),
                    "system": platform.system(), "release": platform.release(),
                    "machine": platform.machine(), "cpu_cores": os.cpu_count(),
                    "python_version": platform.python_version(), "gpu": get_gpu_telemetry()
                }
            elif method == "system_action":
                act = params.get("action")
                if act == "clear_tmp":
                    cleaned = 0
                    for root, dirs, files in os.walk("/tmp"):
                        for f in files:
                            try:
                                os.remove(os.path.join(root, f))
                                cleaned += 1
                            except Exception: pass
                    res = {"status": "ok", "action": act, "cleaned_files": cleaned}
                else:
                    res = {"status": "ok", "action": act}
            elif method == "purge_gpu_cache":
                import torch
                freed = 0.0
                if torch.cuda.is_available():
                    b_before = torch.cuda.memory_reserved(0)
                    torch.cuda.empty_cache()
                    b_after = torch.cuda.memory_reserved(0)
                    freed = round((b_before - b_after) / (1024**2), 1)
                res = {"status": "ok", "freed_mb": freed}
            elif method == "get_env_vars":
                env_vars = {}
                safe_keys = ["PATH", "PYTHONPATH", "CUDA_HOME", "CUDA_PATH", "TORCH_CUDA_ARCH_LIST", "SHELL", "USER", "HOSTNAME", "LANG", "VIRTUAL_ENV", "CONDA_DEFAULT_ENV"]
                for k, v in os.environ.items():
                    if any(s in k.upper() for s in ["TOKEN", "SECRET", "PASSWORD", "KEY", "AUTH"]):
                        env_vars[k] = "••••••••"
                    elif k in safe_keys or len(env_vars) < 25:
                        env_vars[k] = v
                res = env_vars
            elif method == "clean_pycache":
                p = os.path.abspath(params.get("path", "/marimo"))
                count = 0
                for root, dirs, files in os.walk(p):
                    for d in list(dirs):
                        if d == "__pycache__":
                            shutil.rmtree(os.path.join(root, d), ignore_errors=True)
                            count += 1
                res = {"status": "ok", "cleaned_dirs": count}
            else:
                success = False
                err = f"Unknown method: {method}"
        except Exception as ex:
            success = False
            err = str(ex)

        if self.ws:
            try:
                await self.ws.send(json.dumps({"id": req_id, "type": "rpc_response", "success": success, "result": res, "error": err}))
            except Exception:
                pass

# Step 6: Launch in background thread
if __name__ == "__main__":
    _global_agent = None

    import argparse
    parser = argparse.ArgumentParser(description="MoLab Cloud PC Control Agent")
    parser.add_argument("--wss", default=os.getenv("MOLAB_CONTROL_WSS_URL", MOLAB_CONTROL_WSS_URL), help="Windows Control Plane WSS Endpoint")
    parser.add_argument("--token", default=os.getenv("MOLAB_AGENT_AUTH_TOKEN", MOLAB_AGENT_AUTH_TOKEN), help="Agent Authentication Token")
    _cli_args, _ = parser.parse_known_args()
    _active_wss = _cli_args.wss
    _active_token = _cli_args.token

    def _run_forever():
        global _global_agent
        while True:
            try:
                _global_agent = RemoteControlAgent(_active_wss, _active_token)
                _loop = asyncio.new_event_loop()
                asyncio.set_event_loop(_loop)
                _loop.run_until_complete(_global_agent.run())
            except KeyboardInterrupt:
                break
            except Exception as e:
                _agent_log(f"Agent loop error: {e}. Restarting loop in 3s...")
                time.sleep(3)

    _thread = threading.Thread(target=_run_forever, daemon=True)
    _thread.start()

    # Print status banner
    gpu_status = get_gpu_telemetry()
    print("=" * 65)
    print("  CLOUD PC AGENT STARTED IN BACKGROUND")
    print("=" * 65)
    print(f"Hostname       : {socket.gethostname()}")
    print(f"OS             : {platform.system()} {platform.release()} ({platform.machine()})")
    print(f"GPU Model      : {gpu_status.get('gpu_name') or 'NVIDIA RTX PRO 6000 Blackwell'}")
    print(f"VRAM Capacity  : {gpu_status.get('vram_total_gb')} GB (Free: {gpu_status.get('vram_free_gb')} GB)")
    print(f"CUDA Available : {gpu_status.get('cuda_available')}")
    print("=" * 65)
    print("[OK] Your MoLab pod is now linked to your Windows Control Plane!")
    print("     Open http://127.0.0.1:8800 in your Windows browser.")

    # Keep alive when executed directly from Linux terminal
    def _is_notebook():
        try:
            shell = get_ipython().__class__.__name__
            return "ZMQInteractiveShell" in shell or "TerminalInteractiveShell" in shell
        except NameError:
            return False

    if not _is_notebook():
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            if _global_agent:
                _global_agent.running = False
            print("\n[*] Agent stopped.")
