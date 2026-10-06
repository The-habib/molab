import os
import subprocess
from typing import List, Dict, Any

def get_log_sources() -> List[Dict[str, str]]:
    sources = [
        {"id": "agent", "name": "Cloud PC Agent Log", "path": "/tmp/molab_agent.log"}
    ]
    if os.name == "posix":
        if os.path.exists("/var/log/syslog"):
            sources.append({"id": "syslog", "name": "System Log (/var/log/syslog)", "path": "/var/log/syslog"})
        if os.path.exists("/var/log/dmesg"):
            sources.append({"id": "dmesg", "name": "Kernel Ring Buffer (/var/log/dmesg)", "path": "/var/log/dmesg"})
        if os.path.exists("/var/log/auth.log"):
            sources.append({"id": "auth", "name": "Auth Log (/var/log/auth.log)", "path": "/var/log/auth.log"})
    return sources

def tail_log(source: str, lines: int = 100) -> Dict[str, Any]:
    lines = min(max(10, lines), 500)
    output_lines = []

    if source == "agent" and os.path.exists("/tmp/molab_agent.log"):
        with open("/tmp/molab_agent.log", "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
            output_lines = all_lines[-lines:]

    elif os.name == "posix":
        if source in ["syslog", "auth", "dmesg"]:
            path = f"/var/log/{source}.log" if source != "dmesg" else "/var/log/dmesg"
            if os.path.exists(path):
                cmd = ["tail", "-n", str(lines), path]
                res = subprocess.run(cmd, capture_output=True, text=True)
                if res.returncode == 0:
                    output_lines = res.stdout.splitlines(keepends=True)
            elif source == "dmesg":
                cmd = ["dmesg", "-T"]
                res = subprocess.run(cmd, capture_output=True, text=True)
                if res.returncode == 0:
                    output_lines = res.stdout.splitlines(keepends=True)[-lines:]
    else:
        output_lines = [f"[LOG] Simulating live log stream for {source}\n"]

    return {
        "source": source,
        "line_count": len(output_lines),
        "content": "".join(output_lines)
    }
