import os
import signal
import subprocess
from typing import List, Dict, Any

def list_processes() -> List[Dict[str, Any]]:
    procs = []
    try:
        import psutil
        for p in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent', 'cmdline', 'status']):
            try:
                info = p.info
                cmd = " ".join(info['cmdline']) if info.get('cmdline') else info.get('name', '')
                procs.append({
                    "pid": info['pid'],
                    "name": info['name'] or "unknown",
                    "user": info.get('username') or "root",
                    "cpu_percent": round(info.get('cpu_percent') or 0.0, 1),
                    "memory_percent": round(info.get('memory_percent') or 0.0, 1),
                    "cmd": cmd[:120],
                    "status": info.get('status') or "running"
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
    except ImportError:
        # Fallback reading /proc or ps
        try:
            res = subprocess.run(["ps", "-eo", "pid,user,%cpu,%mem,comm,args"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                lines = res.stdout.strip().split("\n")[1:]
                for line in lines:
                    parts = line.split(None, 5)
                    if len(parts) >= 6:
                        try:
                            procs.append({
                                "pid": int(parts[0]),
                                "user": parts[1],
                                "cpu_percent": float(parts[2]),
                                "memory_percent": float(parts[3]),
                                "name": parts[4],
                                "cmd": parts[5][:120],
                                "status": "running"
                            })
                        except ValueError:
                            continue
        except Exception:
            pass

    # Sort by CPU usage descending
    procs.sort(key=lambda x: x["cpu_percent"], reverse=True)
    return procs[:200]

def kill_process(pid: int, sig_num: int = 15) -> Dict[str, Any]:
    if pid <= 1:
        raise PermissionError(f"Cannot terminate system process PID {pid}")
    
    sig = signal.SIGTERM if sig_num == 15 else signal.SIGKILL
    os.kill(pid, sig)
    return {"status": "ok", "pid": pid, "signal": sig_num}
