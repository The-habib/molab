import os
import sys
import time
import json
import random
import socket
import platform
import asyncio
import logging
import websockets
from typing import Optional, Dict, Any

from agent.telemetry import get_full_telemetry, get_gpu_telemetry
from agent.pty_handler import agent_pty_manager
from agent import file_ops, proc_ops, service_ops, storage_ops, network_ops, log_ops, container_ops

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("molab_agent")

class MolabAgent:
    def __init__(self, wss_url: str, token: str, agent_id: Optional[str] = None):
        self.wss_url = wss_url
        self.token = token
        self.agent_id = agent_id or f"molab-{platform.node() or 'worker'}"
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._running = False
        self._heartbeat_interval = 3.0

    def get_hardware_info(self) -> Dict[str, Any]:
        gpu = get_gpu_telemetry()
        return {
            "agent_id": self.agent_id,
            "hostname": socket.gethostname(),
            "os": platform.system(),
            "os_release": platform.release(),
            "arch": platform.machine(),
            "python_version": platform.python_version(),
            "cpu_count": os.cpu_count() or 1,
            "gpu": gpu
        }

    async def run_forever(self):
        self._running = True
        backoff = 2.0
        max_backoff = 30.0

        while self._running:
            try:
                connect_url = self.wss_url
                if self.token and "?" not in connect_url:
                    connect_url = f"{connect_url}?token={self.token}"

                logger.info(f"Connecting to Control Plane: {self.wss_url}...")
                
                async with websockets.connect(
                    connect_url,
                    ping_interval=20,
                    ping_timeout=20,
                    max_size=50 * 1024 * 1024
                ) as ws:
                    self.ws = ws
                    backoff = 2.0  # Reset backoff on successful connect
                    logger.info("Connected to Control Plane! Sending hardware registration...")

                    # 1. Registration
                    reg_payload = self.get_hardware_info()
                    await ws.send(json.dumps(reg_payload))
                    ack_raw = await ws.recv()
                    logger.info(f"Registration acknowledged: {ack_raw}")

                    # 2. Start heartbeat & message loops concurrently
                    heartbeat_task = asyncio.create_task(self._heartbeat_loop())
                    receive_task = asyncio.create_task(self._receive_loop())

                    done, pending = await asyncio.wait(
                        [heartbeat_task, receive_task],
                        return_when=asyncio.FIRST_COMPLETED
                    )
                    for t in pending:
                        t.cancel()

            except asyncio.CancelledError:
                logger.info("Agent stopped.")
                break
            except Exception as e:
                jitter = random.uniform(0.5, 1.5)
                delay = min(max_backoff, backoff * jitter)
                logger.warning(f"Connection lost or failed ({e}). Reconnecting in {round(delay, 1)}s...")
                await asyncio.sleep(delay)
                backoff = min(max_backoff, backoff * 1.5)

    async def _heartbeat_loop(self):
        while self._running and self.ws:
            try:
                telemetry = get_full_telemetry()
                msg = {
                    "type": "heartbeat",
                    "timestamp": time.time(),
                    "telemetry": telemetry
                }
                await self.ws.send(json.dumps(msg))
                await asyncio.sleep(self._heartbeat_interval)
            except Exception as e:
                logger.debug(f"Heartbeat send failed: {e}")
                break

    async def _receive_loop(self):
        while self._running and self.ws:
            try:
                raw_msg = await self.ws.recv()
            except Exception:
                break
            try:
                msg = json.loads(raw_msg)
            except Exception:
                continue

            msg_type = msg.get("type")

            if msg_type == "rpc_request":
                asyncio.create_task(self._handle_rpc(msg))

            elif msg_type == "pty_input":
                agent_pty_manager.write_input(msg.get("session_id"), msg.get("data", ""))

            elif msg_type == "pty_resize":
                agent_pty_manager.resize(msg.get("session_id"), msg.get("cols", 80), msg.get("rows", 24))

            elif msg_type == "pty_close":
                agent_pty_manager.close_session(msg.get("session_id"))

    async def _handle_rpc(self, msg: dict):
        req_id = msg.get("id")
        method = msg.get("method")
        params = msg.get("params", {})

        success = True
        result = None
        error = None

        try:
            if method == "get_telemetry":
                result = get_full_telemetry()

            elif method == "get_gpu_telemetry":
                result = get_gpu_telemetry()

            elif method == "run_gpu_benchmark":
                result = self._execute_gpu_benchmark(params.get("matrix_size", 4096), params.get("iterations", 10))

            elif method == "list_files":
                result = file_ops.list_files(params.get("path", "/workspace"))

            elif method == "read_file":
                result = file_ops.read_file(params.get("path"))

            elif method == "write_file":
                result = file_ops.write_file(params.get("path"), params.get("content"))

            elif method == "mkdir":
                result = file_ops.mkdir(params.get("path"))

            elif method == "delete_file":
                result = file_ops.delete_file(params.get("path"))

            elif method == "rename":
                result = file_ops.rename(params.get("src"), params.get("dst"))

            elif method == "upload_file":
                result = file_ops.upload_file(params.get("path"), params.get("b64_content"))

            elif method == "download_file":
                result = file_ops.download_file(params.get("path"))

            elif method == "list_processes":
                result = proc_ops.list_processes()

            elif method == "kill_process":
                result = proc_ops.kill_process(params.get("pid"), params.get("signal", 15))

            elif method == "list_services":
                result = service_ops.list_services()

            elif method == "control_service":
                result = service_ops.control_service(params.get("service_name"), params.get("action"))

            elif method == "get_storage_disks":
                result = storage_ops.get_storage_disks()

            elif method == "analyze_storage":
                result = storage_ops.analyze_storage(params.get("path", "/workspace"))

            elif method == "get_network_interfaces":
                result = network_ops.get_network_interfaces()

            elif method == "network_diagnose":
                result = network_ops.network_diagnose(params.get("tool"), params.get("target"))

            elif method == "list_containers":
                result = container_ops.list_containers()

            elif method == "control_container":
                result = container_ops.control_container(params.get("container_id"), params.get("action"))

            elif method == "get_log_sources":
                result = log_ops.get_log_sources()

            elif method == "tail_log":
                result = log_ops.tail_log(params.get("source"), params.get("lines", 100))

            elif method == "get_system_info":
                result = self._get_full_system_info()

            elif method == "system_action":
                result = self._handle_system_action(params.get("action"))

            elif method == "execute_job":
                result = await self._handle_job(params)

            elif method == "pty_open":
                sid = params.get("session_id")
                cols = params.get("cols", 80)
                rows = params.get("rows", 24)
                shell = params.get("shell", "/bin/bash")

                async def on_output(data: str):
                    if self.ws:
                        try:
                            await self.ws.send(json.dumps({
                                "type": "pty_output",
                                "session_id": sid,
                                "data": data
                            }))
                        except Exception:
                            pass

                async def on_exit(code: int):
                    if self.ws:
                        try:
                            await self.ws.send(json.dumps({
                                "type": "pty_exit",
                                "session_id": sid,
                                "exit_code": code
                            }))
                        except Exception:
                            pass

                await agent_pty_manager.open_session(sid, shell, cols, rows, on_output, on_exit)
                result = {"status": "pty_opened", "session_id": sid}

            else:
                success = False
                error = f"Unknown RPC method: {method}"

        except Exception as e:
            logger.error(f"Error handling RPC {method}: {e}")
            success = False
            error = str(e)

        if self.ws:
            try:
                resp = {
                    "id": req_id,
                    "type": "rpc_response",
                    "success": success,
                    "result": result,
                    "error": error
                }
                await self.ws.send(json.dumps(resp))
            except Exception:
                pass

    def _execute_gpu_benchmark(self, matrix_size: int = 4096, iterations: int = 10) -> Dict[str, Any]:
        try:
            import torch
            if not torch.cuda.is_available():
                return {"success": False, "error": "CUDA is not available on this worker."}

            device = torch.device("cuda:0")
            gpu_name = torch.cuda.get_device_name(0)

            # Warm-up
            a = torch.randn(matrix_size, matrix_size, device=device, dtype=torch.float32)
            b = torch.randn(matrix_size, matrix_size, device=device, dtype=torch.float32)
            c = torch.matmul(a, b)
            torch.cuda.synchronize()

            # Benchmark
            start_event = torch.cuda.Event(enable_timing=True)
            end_event = torch.cuda.Event(enable_timing=True)

            start_event.record()
            for _ in range(iterations):
                c = torch.matmul(a, b)
            end_event.record()
            torch.cuda.synchronize()

            elapsed_ms = start_event.elapsed_time(end_event)
            avg_ms = elapsed_ms / iterations
            ops_per_matmul = 2 * (matrix_size ** 3)
            tflops = round((ops_per_matmul / (avg_ms / 1000.0)) / 1e12, 2)

            return {
                "success": True,
                "gpu_name": gpu_name,
                "matrix_size": matrix_size,
                "iterations": iterations,
                "total_elapsed_ms": round(elapsed_ms, 2),
                "avg_iteration_ms": round(avg_ms, 2),
                "throughput_tflops": tflops,
                "cuda_device": str(device)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _get_full_system_info(self) -> Dict[str, Any]:
        gpu = get_gpu_telemetry()
        return {
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "cpu_cores": os.cpu_count(),
            "python_version": platform.python_version(),
            "uptime_seconds": round(time.time() - getattr(self, "_start_time", time.time()), 1),
            "gpu": gpu
        }

    def _handle_system_action(self, action: str) -> Dict[str, Any]:
        if action == "clear_tmp":
            tmp_path = "/tmp" if os.name == "posix" else "C:\\temp"
            cleared = 0
            if os.path.exists(tmp_path):
                for item in os.listdir(tmp_path):
                    ip = os.path.join(tmp_path, item)
                    try:
                        if os.path.isfile(ip):
                            os.remove(ip)
                            cleared += 1
                    except Exception:
                        pass
            return {"status": "ok", "action": "clear_tmp", "cleared_files": cleared}
        elif action == "restart_agent":
            # Restart agent process
            return {"status": "ok", "action": "restart_agent"}
        elif action == "reboot":
            if os.name == "posix":
                import subprocess
                subprocess.Popen(["reboot"])
            return {"status": "ok", "action": "reboot_initiated"}
        return {"status": "unknown_action"}

    async def _handle_job(self, params: dict) -> Any:
        job_type = params.get("job_type")
        payload = params.get("payload", {})
        if job_type == "benchmark":
            return self._execute_gpu_benchmark(payload.get("matrix_size", 4096), payload.get("iterations", 10))
        elif job_type == "ping":
            return {"pong": True, "time": time.time()}
        elif job_type == "gpu_status":
            return get_gpu_telemetry()
        else:
            return {"status": "completed", "job_type": job_type, "payload": payload}

if __name__ == "__main__":
    wss = os.getenv("MOLAB_CONTROL_WSS_URL", "ws://127.0.0.1:8800/ws/agent")
    token = os.getenv("MOLAB_AGENT_AUTH_TOKEN", "")
    agent = MolabAgent(wss_url=wss, token=token)
    agent._start_time = time.time()
    try:
        asyncio.run(agent.run_forever())
    except KeyboardInterrupt:
        logger.info("Agent stopped by user.")
