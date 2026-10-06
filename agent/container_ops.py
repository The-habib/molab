import subprocess
import shutil
import json
from typing import List, Dict, Any

def list_containers() -> List[Dict[str, Any]]:
    containers = []
    # Check docker
    docker_bin = shutil.which("docker") or shutil.which("podman")
    if not docker_bin:
        return []

    try:
        cmd = [docker_bin, "ps", "-a", "--format", "{{json .}}"]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            for line in res.stdout.strip().split("\n"):
                if line.strip():
                    try:
                        c = json.loads(line)
                        containers.append({
                            "id": c.get("ID", "")[:12],
                            "image": c.get("Image", ""),
                            "status": c.get("Status", ""),
                            "state": c.get("State", ""),
                            "names": c.get("Names", ""),
                            "ports": c.get("Ports", "")
                        })
                    except json.JSONDecodeError:
                        continue
    except Exception:
        pass

    return containers

def control_container(container_id: str, action: str) -> Dict[str, Any]:
    docker_bin = shutil.which("docker") or shutil.which("podman")
    if not docker_bin:
        raise RuntimeError("Neither docker nor podman is installed on this machine.")

    cmd = [docker_bin, action, container_id]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if res.returncode != 0:
        raise RuntimeError(f"Container action {action} failed: {res.stderr.strip()}")

    return {"status": "ok", "container_id": container_id, "action": action}
