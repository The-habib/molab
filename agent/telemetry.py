import os
import sys
import time
import shutil
import subprocess
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("agent.telemetry")

_last_net_bytes = {"rx": 0, "tx": 0, "time": 0.0}

def get_network_rates() -> Dict[str, float]:
    global _last_net_bytes
    rx_bytes = 0
    tx_bytes = 0

    try:
        if os.path.exists("/proc/net/dev"):
            with open("/proc/net/dev", "r") as f:
                lines = f.readlines()[2:]
                for line in lines:
                    parts = line.split()
                    if len(parts) >= 10:
                        iface = parts[0].strip(":")
                        if iface != "lo":
                            rx_bytes += int(parts[1])
                            tx_bytes += int(parts[9])
        else:
            import psutil
            net = psutil.net_io_counters()
            rx_bytes = net.bytes_recv
            tx_bytes = net.bytes_sent
    except Exception:
        pass

    now = time.time()
    dt = now - _last_net_bytes["time"]
    rx_rate_kbs = 0.0
    tx_rate_kbs = 0.0

    if dt > 0 and _last_net_bytes["time"] > 0:
        rx_rate_kbs = round((rx_bytes - _last_net_bytes["rx"]) / (dt * 1024.0), 1)
        tx_rate_kbs = round((tx_bytes - _last_net_bytes["tx"]) / (dt * 1024.0), 1)

    _last_net_bytes = {"rx": rx_bytes, "tx": tx_bytes, "time": now}
    return {
        "rx_kbs": max(0.0, rx_rate_kbs),
        "tx_kbs": max(0.0, tx_rate_kbs),
        "total_rx_mb": round(rx_bytes / (1024 * 1024), 2),
        "total_tx_mb": round(tx_bytes / (1024 * 1024), 2)
    }

def get_cpu_telemetry() -> Dict[str, Any]:
    try:
        import psutil
        cpu_pct = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True)
        return {"cpu_percent": cpu_pct, "cpu_count": cpu_count}
    except Exception:
        return {"cpu_percent": 0.0, "cpu_count": os.cpu_count() or 1}

def get_memory_telemetry() -> Dict[str, Any]:
    try:
        import psutil
        vm = psutil.virtual_memory()
        return {
            "ram_total_gb": round(vm.total / (1024**3), 2),
            "ram_used_gb": round(vm.used / (1024**3), 2),
            "ram_free_gb": round(vm.available / (1024**3), 2),
            "ram_percent": vm.percent
        }
    except Exception:
        # Fallback reading /proc/meminfo
        if os.path.exists("/proc/meminfo"):
            try:
                mem = {}
                with open("/proc/meminfo", "r") as f:
                    for line in f:
                        parts = line.split(":")
                        if len(parts) == 2:
                            mem[parts[0].strip()] = int(parts[1].strip().split()[0])
                total = mem.get("MemTotal", 0) * 1024
                free = mem.get("MemAvailable", mem.get("MemFree", 0)) * 1024
                used = total - free
                pct = round((used / total) * 100, 1) if total > 0 else 0
                return {
                    "ram_total_gb": round(total / (1024**3), 2),
                    "ram_used_gb": round(used / (1024**3), 2),
                    "ram_free_gb": round(free / (1024**3), 2),
                    "ram_percent": pct
                }
            except Exception:
                pass
        return {"ram_total_gb": 0, "ram_used_gb": 0, "ram_free_gb": 0, "ram_percent": 0}

def get_disk_telemetry() -> Dict[str, Any]:
    try:
        root_path = "/" if os.name == "posix" else "C:\\"
        total, used, free = shutil.disk_usage(root_path)
        pct = round((used / total) * 100, 1) if total > 0 else 0
        return {
            "disk_total_gb": round(total / (1024**3), 2),
            "disk_used_gb": round(used / (1024**3), 2),
            "disk_free_gb": round(free / (1024**3), 2),
            "disk_percent": pct,
            "root_path": root_path
        }
    except Exception:
        return {"disk_total_gb": 0, "disk_used_gb": 0, "disk_free_gb": 0, "disk_percent": 0, "root_path": "/"}

def get_gpu_telemetry() -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "cuda_available": False,
        "gpu_name": None,
        "vram_total_gb": 0.0,
        "vram_used_gb": 0.0,
        "vram_free_gb": 0.0,
        "vram_percent": 0.0,
        "utilization_pct": 0,
        "temperature_c": None,
        "power_draw_w": None,
        "power_limit_w": None,
        "driver_version": None,
        "cuda_version": None,
        "torch_version": None,
        "processes": []
    }

    # 1. PyTorch inspection
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
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"PyTorch telemetry check error: {e}")

    # 2. nvidia-smi detailed query
    try:
        cmd = [
            "nvidia-smi",
            "--query-gpu=utilization.gpu,temperature.gpu,power.draw,power.limit,driver_version",
            "--format=csv,noheader,nounits"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            if len(parts) >= 5:
                try:
                    out["utilization_pct"] = int(float(parts[0]))
                except ValueError:
                    pass
                try:
                    out["temperature_c"] = int(float(parts[1]))
                except ValueError:
                    pass
                try:
                    out["power_draw_w"] = round(float(parts[2]), 1)
                except ValueError:
                    pass
                try:
                    out["power_limit_w"] = round(float(parts[3]), 1)
                except ValueError:
                    pass
                out["driver_version"] = parts[4]
    except Exception:
        pass

    # 3. GPU processes query
    try:
        cmd = [
            "nvidia-smi",
            "--query-compute-apps=pid,process_name,used_memory",
            "--format=csv,noheader,nounits"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and res.stdout.strip():
            procs = []
            for line in res.stdout.strip().split("\n"):
                p_parts = [p.strip() for p in line.split(",")]
                if len(p_parts) >= 3:
                    try:
                        procs.append({
                            "pid": int(p_parts[0]),
                            "name": p_parts[1],
                            "used_vram_mb": float(p_parts[2])
                        })
                    except ValueError:
                        pass
            out["processes"] = procs
    except Exception:
        pass

    return out

def get_full_telemetry() -> Dict[str, Any]:
    net = get_network_rates()
    cpu = get_cpu_telemetry()
    mem = get_memory_telemetry()
    disk = get_disk_telemetry()
    gpu = get_gpu_telemetry()

    return {
        "timestamp": time.time(),
        "cpu": cpu,
        "memory": mem,
        "disk": disk,
        "network": net,
        "gpu": gpu
    }
