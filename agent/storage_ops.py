import os
import shutil
from typing import List, Dict, Any

def get_storage_disks() -> List[Dict[str, Any]]:
    disks = []
    try:
        import psutil
        partitions = psutil.disk_partitions(all=False)
        for p in partitions:
            try:
                usage = psutil.disk_usage(p.mountpoint)
                disks.append({
                    "device": p.device,
                    "mountpoint": p.mountpoint,
                    "fstype": p.fstype,
                    "total_gb": round(usage.total / (1024**3), 2),
                    "used_gb": round(usage.used / (1024**3), 2),
                    "free_gb": round(usage.free / (1024**3), 2),
                    "percent": usage.percent
                })
            except (PermissionError, OSError):
                continue
    except Exception:
        # Fallback to shutil root usage
        root = "/" if os.name == "posix" else "C:\\"
        tot, used, free = shutil.disk_usage(root)
        disks.append({
            "device": "root",
            "mountpoint": root,
            "fstype": "ext4" if os.name == "posix" else "NTFS",
            "total_gb": round(tot / (1024**3), 2),
            "used_gb": round(used / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2),
            "percent": round((used / tot) * 100, 1)
        })

    return disks

def analyze_storage(path: str = "/workspace") -> Dict[str, Any]:
    norm_path = os.path.abspath(path)
    if not os.path.exists(norm_path):
        norm_path = os.getcwd()

    items = []
    total_size = 0
    try:
        with os.scandir(norm_path) as it:
            for entry in it:
                try:
                    st = entry.stat(follow_symlinks=False)
                    sz = st.st_size
                    total_size += sz
                    items.append({
                        "name": entry.name,
                        "path": entry.path.replace("\\", "/"),
                        "is_dir": entry.is_dir(follow_symlinks=False),
                        "size_mb": round(sz / (1024*1024), 2)
                    })
                except Exception:
                    continue
    except Exception as e:
        raise RuntimeError(f"Failed to analyze path: {e}")

    items.sort(key=lambda x: x["size_mb"], reverse=True)
    return {
        "analyzed_path": norm_path.replace("\\", "/"),
        "total_size_mb": round(total_size / (1024*1024), 2),
        "largest_items": items[:25]
    }
