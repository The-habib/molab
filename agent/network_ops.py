import os
import socket
import subprocess
import time
from typing import List, Dict, Any

def get_network_interfaces() -> List[Dict[str, Any]]:
    ifaces = []
    try:
        import psutil
        addrs = psutil.net_if_addrs()
        stats = psutil.net_if_stats()
        io = psutil.net_io_counters(pernic=True)

        for name, addr_list in addrs.items():
            ip_v4 = None
            for a in addr_list:
                if a.family == socket.AF_INET:
                    ip_v4 = a.address
                    break

            is_up = stats[name].isup if name in stats else True
            speed = stats[name].speed if name in stats else 0
            rx_mb = round(io[name].bytes_recv / (1024**2), 1) if name in io else 0
            tx_mb = round(io[name].bytes_sent / (1024**2), 1) if name in io else 0

            ifaces.append({
                "interface": name,
                "ip": ip_v4 or "N/A",
                "status": "UP" if is_up else "DOWN",
                "speed_mbps": speed,
                "rx_mb": rx_mb,
                "tx_mb": tx_mb
            })
    except Exception:
        # Fallback hostname query
        try:
            h = socket.gethostname()
            ip = socket.gethostbyname(h)
            ifaces.append({
                "interface": "eth0",
                "ip": ip,
                "status": "UP",
                "speed_mbps": 1000,
                "rx_mb": 0,
                "tx_mb": 0
            })
        except Exception:
            pass

    return ifaces

def network_diagnose(tool: str, target: str) -> Dict[str, Any]:
    target = target.strip()
    if not target:
        raise ValueError("Target address cannot be empty")

    # Safe validation of target to avoid arbitrary command injection
    import re
    if not re.match(r"^[a-zA-Z0-9\.\-_:/]+$", target):
        raise ValueError("Invalid target format")

    start_time = time.time()
    output = ""
    success = False

    if tool == "ping":
        count_flag = "-c" if os.name == "posix" else "-n"
        cmd = ["ping", count_flag, "3", target]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        output = res.stdout if res.returncode == 0 else res.stderr
        success = res.returncode == 0

    elif tool == "dns":
        try:
            ips = socket.gethostbyname_ex(target)[2]
            output = f"DNS resolution for {target}:\n" + "\n".join(f" - {ip}" for ip in ips)
            success = True
        except Exception as e:
            output = f"DNS lookup failed: {e}"
            success = False

    elif tool == "http":
        import urllib.request
        url = target if target.startswith("http") else f"https://{target}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CloudPC-Diagnostics/1.0"})
            with urllib.request.urlopen(req, timeout=5) as r:
                output = f"HTTP {r.status} {r.reason}\nHeaders:\n" + "\n".join(f"{k}: {v}" for k, v in r.headers.items())
                success = True
        except Exception as e:
            output = f"HTTP connection failed: {e}"
            success = False

    elapsed_ms = round((time.time() - start_time) * 1000.0, 1)
    return {
        "tool": tool,
        "target": target,
        "success": success,
        "elapsed_ms": elapsed_ms,
        "output": output
    }
