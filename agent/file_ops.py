import os
import shutil
import base64
import stat
import time
from typing import Dict, Any

PROTECTED_PATHS = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/sys", "/usr", "/sbin", "C:\\", "C:\\Windows"]

def list_files(path: str = "/workspace") -> Dict[str, Any]:
    norm_path = os.path.abspath(path)
    if not os.path.exists(norm_path):
        # Fallback to current working directory if requested path does not exist
        norm_path = os.getcwd()

    parent = os.path.dirname(norm_path)
    if parent == norm_path:
        parent = None

    entries = []
    try:
        with os.scandir(norm_path) as it:
            for entry in it:
                try:
                    st = entry.stat(follow_symlinks=False)
                    is_dir = entry.is_dir(follow_symlinks=False)
                    mode_str = stat.filemode(st.st_mode)
                    entries.append({
                        "name": entry.name,
                        "path": entry.path.replace("\\", "/"),
                        "is_dir": is_dir,
                        "size": st.st_size if not is_dir else None,
                        "modified": st.st_mtime,
                        "permissions": mode_str
                    })
                except Exception:
                    continue
    except PermissionError as e:
        raise PermissionError(f"Permission denied: {norm_path}")

    # Sort: directories first, then alphabetical
    entries.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

    return {
        "current_path": norm_path.replace("\\", "/"),
        "parent_path": parent.replace("\\", "/") if parent else None,
        "entries": entries
    }

def read_file(path: str) -> Dict[str, Any]:
    norm_path = os.path.abspath(path)
    if not os.path.exists(norm_path) or not os.path.isfile(norm_path):
        raise FileNotFoundError(f"File not found: {path}")

    st = os.stat(norm_path)
    if st.st_size > 5 * 1024 * 1024:
        raise ValueError(f"File too large to view directly ({round(st.st_size / (1024*1024), 2)} MB). Max limit is 5MB.")

    with open(norm_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    return {
        "path": norm_path.replace("\\", "/"),
        "size": st.st_size,
        "content": content
    }

def write_file(path: str, content: str) -> Dict[str, Any]:
    norm_path = os.path.abspath(path)
    os.makedirs(os.path.dirname(norm_path), exist_ok=True)
    with open(norm_path, "w", encoding="utf-8") as f:
        f.write(content)
    return {"status": "ok", "path": norm_path.replace("\\", "/")}

def mkdir(path: str) -> Dict[str, Any]:
    norm_path = os.path.abspath(path)
    os.makedirs(norm_path, exist_ok=True)
    return {"status": "ok", "path": norm_path.replace("\\", "/")}

def rename(src: str, dst: str) -> Dict[str, Any]:
    norm_src = os.path.abspath(src)
    norm_dst = os.path.abspath(dst)
    os.rename(norm_src, norm_dst)
    return {"status": "ok", "src": norm_src.replace("\\", "/"), "dst": norm_dst.replace("\\", "/")}

def delete_file(path: str) -> Dict[str, Any]:
    norm_path = os.path.abspath(path).replace("\\", "/")
    if norm_path in [p.rstrip("/") for p in PROTECTED_PATHS]:
        raise PermissionError(f"Deleting root path '{norm_path}' is protected.")

    if os.path.isdir(norm_path):
        shutil.rmtree(norm_path)
    elif os.path.exists(norm_path):
        os.remove(norm_path)
    else:
        raise FileNotFoundError(f"Path does not exist: {path}")

    return {"status": "ok", "deleted": norm_path}

def upload_file(path: str, b64_content: str) -> Dict[str, Any]:
    norm_path = os.path.abspath(path)
    os.makedirs(os.path.dirname(norm_path), exist_ok=True)
    data = base64.b64decode(b64_content)
    with open(norm_path, "wb") as f:
        f.write(data)
    return {"status": "ok", "path": norm_path.replace("\\", "/"), "bytes_written": len(data)}

def download_file(path: str) -> Dict[str, Any]:
    norm_path = os.path.abspath(path)
    if not os.path.exists(norm_path) or not os.path.isfile(norm_path):
        raise FileNotFoundError(f"File not found: {path}")

    st = os.stat(norm_path)
    if st.st_size > 100 * 1024 * 1024:
        raise ValueError(f"File too large to download in single request ({round(st.st_size / (1024*1024), 2)} MB). Max limit is 100MB.")

    with open(norm_path, "rb") as f:
        data = f.read()

    return {
        "path": norm_path.replace("\\", "/"),
        "size": len(data),
        "b64_content": base64.b64encode(data).decode("ascii")
    }
