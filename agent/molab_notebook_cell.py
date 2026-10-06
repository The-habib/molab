"""
MoLab Cloud PC Control Agent - Single Cell Notebook Launcher
Copy and paste this entire cell into your MoLab notebook to connect
your NVIDIA RTX PRO 6000 Blackwell GPU to your Windows Control Plane.
"""

# Cell Configuration: Replace with your Cloudflare WSS URL and Token
MOLAB_CONTROL_WSS_URL = "wss://<YOUR-CLOUDFLARE-HOST>.trycloudflare.com/ws/agent"
MOLAB_AGENT_AUTH_TOKEN = "<YOUR-AGENT-AUTH-TOKEN>"

import os
import sys
import time
import json
import random
import socket
import platform
import asyncio
import subprocess
import threading

# 1. Ensure dependencies
try:
    import websockets
    import psutil
except ImportError:
    print("[*] Installing required packages (websockets, psutil)...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "websockets", "psutil"])
    import websockets
    import psutil

# 2. Hardware Telemetry
def get_gpu_telemetry():
    out = {
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
        "cuda_version": None,
        "torch_version": None,
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
                out["utilization_pct"] = int(float(parts[0]))
                out["temperature_c"] = int(float(parts[1]))
                out["power_draw_w"] = round(float(parts[2]), 1)
                out["power_limit_w"] = round(float(parts[3]), 1)
                out["driver_version"] = parts[4]
    except Exception:
        pass
    return out

# 3. Agent Runner
print("=================================================================")
print("  STARTING MOLAB CLOUD PC CONTROL AGENT")
print("=================================================================")
gpu_info = get_gpu_telemetry()
print(f"Hostname       : {socket.gethostname()}")
print(f"OS             : {platform.system()} {platform.release()} ({platform.machine()})")
print(f"GPU            : {gpu_info.get('gpu_name') or 'CPU'}")
print(f"VRAM           : {gpu_info.get('vram_total_gb')} GB (Free: {gpu_info.get('vram_free_gb')} GB)")
print(f"CUDA Available : {gpu_info.get('cuda_available')}")
print("=================================================================")

from agent.molab_agent import MolabAgent

_agent_instance = None
_agent_task = None

def start_agent_in_background(wss_url=MOLAB_CONTROL_WSS_URL, token=MOLAB_AGENT_AUTH_TOKEN):
    global _agent_instance, _agent_task
    _agent_instance = MolabAgent(wss_url=wss_url, token=token)
    
    # Run on background event loop
    loop = asyncio.new_event_loop()
    t = threading.Thread(target=loop.run_forever, daemon=True)
    t.start()
    _agent_task = asyncio.run_coroutine_threadsafe(_agent_instance.run_forever(), loop)
    print(f"[*] Agent connected in background to {wss_url}")

# To start, run:
# start_agent_in_background()
