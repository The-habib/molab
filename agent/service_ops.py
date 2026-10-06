import os
import subprocess
from typing import List, Dict, Any

def list_services() -> List[Dict[str, Any]]:
    services = []
    if os.name == "posix":
        try:
            cmd = ["systemctl", "list-units", "--type=service", "--all", "--no-pager", "--no-legend"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
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
        
        # If systemctl not available (e.g. lightweight docker container), list /etc/init.d or /etc/systemd
        if not services and os.path.exists("/etc/init.d"):
            for item in os.listdir("/etc/init.d"):
                services.append({
                    "name": item,
                    "load": "loaded",
                    "active": "unknown",
                    "sub": "running",
                    "description": f"Init.d script {item}"
                })
    else:
        # Windows services fallback
        try:
            cmd = ["powershell", "-NoLogo", "-Command", "Get-Service | Select-Object -First 30 Name, Status, DisplayName | ConvertTo-Json"]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                import json
                data = json.loads(res.stdout)
                if isinstance(data, list):
                    for item in data:
                        services.append({
                            "name": item.get("Name"),
                            "load": "loaded",
                            "active": "active" if item.get("Status") == 4 else "inactive",
                            "sub": str(item.get("Status")),
                            "description": item.get("DisplayName")
                        })
        except Exception:
            pass

    return services

def control_service(service_name: str, action: str) -> Dict[str, Any]:
    if os.name == "posix":
        cmd = ["systemctl", action, service_name]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if res.returncode != 0:
            raise RuntimeError(f"Failed to {action} service {service_name}: {res.stderr.strip()}")
        return {"status": "ok", "service": service_name, "action": action}
    else:
        return {"status": "mock_ok", "service": service_name, "action": action}
