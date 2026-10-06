import asyncio
import json
import time
import uuid
import logging
from typing import Dict, Optional, Any, Callable, Set, List
from fastapi import WebSocket

logger = logging.getLogger("agent_manager")

class ConnectedPod:
    def __init__(self, pod_id: str, websocket: WebSocket, reg_data: dict):
        self.pod_id = pod_id
        self.websocket = websocket
        self.info = reg_data
        self.hostname = reg_data.get("hostname", pod_id)
        self.last_heartbeat = time.time()
        self.latency_ms = 0.0
        self.latest_telemetry: Dict[str, Any] = {}
        self.connected_at = time.time()

    @property
    def is_alive(self) -> bool:
        return (time.time() - self.last_heartbeat) < 45.0

    def to_dict(self, is_active: bool = False) -> dict:
        gpu_info = self.latest_telemetry.get("gpu") or {}
        cpu_info = self.latest_telemetry.get("cpu") or {}
        ram_info = self.latest_telemetry.get("ram") or {}
        return {
            "pod_id": self.pod_id,
            "hostname": self.hostname,
            "os": self.info.get("os", "Linux"),
            "os_release": self.info.get("os_release", ""),
            "gpu_name": gpu_info.get("name") or self.info.get("gpu_name") or "NVIDIA GPU",
            "vram_total_gb": gpu_info.get("vram_total_gb") or self.info.get("vram_total_gb") or 0.0,
            "vram_used_gb": gpu_info.get("vram_used_gb") or 0.0,
            "cpu_percent": cpu_info.get("percent") or 0.0,
            "ram_percent": ram_info.get("percent") or 0.0,
            "latency_ms": round(self.latency_ms, 1),
            "connected_at": self.connected_at,
            "is_active": is_active,
            "online": self.is_alive
        }

class AgentManager:
    def __init__(self):
        self.pods: Dict[str, ConnectedPod] = {}
        self.active_pod_id: Optional[str] = None
        self._pending_rpc: Dict[str, asyncio.Future] = {}
        self._telemetry_subscribers: Set[asyncio.Queue] = set()
        self._pty_listeners: Dict[str, Callable[[str], Any]] = {}
        self._pty_exit_listeners: Dict[str, Callable[[int], Any]] = {}
        self._pty_pod_map: Dict[str, str] = {} # session_id -> pod_id

    @property
    def is_online(self) -> bool:
        return any(p.is_alive for p in self.pods.values())

    def get_pod(self, pod_id: Optional[str] = None) -> Optional[ConnectedPod]:
        if pod_id and pod_id in self.pods:
            return self.pods[pod_id]
        if self.active_pod_id and self.active_pod_id in self.pods:
            return self.pods[self.active_pod_id]
        for p in self.pods.values():
            if p.is_alive:
                return p
        return next(iter(self.pods.values()), None)

    @property
    def connected_agent_ws(self) -> Optional[WebSocket]:
        pod = self.get_pod()
        return pod.websocket if pod else None

    @property
    def agent_info(self) -> Dict[str, Any]:
        pod = self.get_pod()
        return pod.info if pod else {}

    @property
    def last_heartbeat(self) -> float:
        pod = self.get_pod()
        return pod.last_heartbeat if pod else 0.0

    @property
    def latency_ms(self) -> float:
        pod = self.get_pod()
        return pod.latency_ms if pod else 0.0

    @property
    def latest_telemetry(self) -> Dict[str, Any]:
        pod = self.get_pod()
        return pod.latest_telemetry if pod else {}

    def list_pods(self) -> List[dict]:
        return [
            p.to_dict(is_active=(p.pod_id == self.active_pod_id))
            for p in self.pods.values()
        ]

    def select_pod(self, pod_id: str) -> bool:
        if pod_id in self.pods:
            self.active_pod_id = pod_id
            logger.info(f"Active pod switched to: {pod_id}")
            return True
        return False

    async def register_agent(self, websocket: WebSocket, registration_data: dict) -> dict:
        pod_id = registration_data.get("hostname") or registration_data.get("agent_id") or f"pod-{uuid.uuid4().hex[:6]}"
        pod = ConnectedPod(pod_id, websocket, registration_data)
        self.pods[pod_id] = pod

        if not self.active_pod_id or self.active_pod_id not in self.pods or not self.pods[self.active_pod_id].is_alive:
            self.active_pod_id = pod_id

        logger.info(f"Remote Pod registered: {pod_id} ({registration_data.get('os', 'Linux')}) | Total active pods: {len(self.pods)}")
        return {
            "status": "registered",
            "pod_id": pod_id,
            "active_pod": self.active_pod_id,
            "total_pods": len(self.pods),
            "server_time": time.time()
        }

    def disconnect_agent(self, pod_id: Optional[str] = None):
        if not pod_id:
            # If no pod_id specified, find and disconnect dead pods
            dead_pods = [pid for pid, p in self.pods.items() if not p.is_alive]
            for pid in dead_pods:
                self.disconnect_agent(pid)
            return

        if pod_id in self.pods:
            logger.warning(f"Remote Pod disconnected: {pod_id}")
            del self.pods[pod_id]

        if self.active_pod_id == pod_id:
            alive_keys = [pid for pid, p in self.pods.items() if p.is_alive]
            self.active_pod_id = alive_keys[0] if alive_keys else None

        logger.info(f"Remaining active pods: {len(self.pods)}")

    async def handle_agent_message(self, message_str: str, pod_id: Optional[str] = None):
        try:
            msg = json.loads(message_str)
        except Exception as e:
            logger.error(f"Failed to parse agent message: {e}")
            return

        pod = self.get_pod(pod_id)
        if not pod:
            return

        msg_type = msg.get("type")

        # 1. Heartbeat
        if msg_type == "heartbeat":
            pod.last_heartbeat = time.time()
            send_ts = msg.get("timestamp", 0)
            if send_ts > 0:
                pod.latency_ms = max(0.0, (time.time() - send_ts) * 1000.0)
            if "telemetry" in msg:
                pod.latest_telemetry = msg["telemetry"]
                # Broadcast telemetry tagged with pod_id
                t_data = dict(pod.latest_telemetry)
                t_data["pod_id"] = pod.pod_id
                t_data["hostname"] = pod.hostname
                t_data["is_active"] = (pod.pod_id == self.active_pod_id)
                await self.broadcast_telemetry(t_data)

            try:
                await pod.websocket.send_text(json.dumps({
                    "type": "heartbeat_ack",
                    "timestamp": time.time(),
                    "pod_id": pod.pod_id
                }))
            except Exception:
                pass

        # 2. RPC response
        elif msg_type == "rpc_response":
            req_id = msg.get("id")
            if req_id in self._pending_rpc:
                fut = self._pending_rpc.pop(req_id)
                if not fut.done():
                    if msg.get("success", False):
                        fut.set_result(msg.get("result"))
                    else:
                        fut.set_exception(RuntimeError(msg.get("error", "RPC execution failed")))

        # 3. PTY output stream
        elif msg_type == "pty_output":
            session_id = msg.get("session_id")
            data = msg.get("data", "")
            if session_id and session_id in self._pty_listeners:
                callback = self._pty_listeners[session_id]
                if asyncio.iscoroutinefunction(callback):
                    await callback(data)
                else:
                    callback(data)

        # 4. PTY exit
        elif msg_type == "pty_exit":
            session_id = msg.get("session_id")
            exit_code = msg.get("exit_code", 0)
            if session_id and session_id in self._pty_exit_listeners:
                callback = self._pty_exit_listeners[session_id]
                if asyncio.iscoroutinefunction(callback):
                    await callback(exit_code)
                else:
                    callback(exit_code)

    async def call_rpc(self, method: str, params: Optional[dict] = None, timeout: float = 30.0, pod_id: Optional[str] = None) -> Any:
        pod = self.get_pod(pod_id)
        if not pod or not pod.is_alive:
            raise ConnectionError(f"Target Pod '{pod_id or 'active'}' is offline or not connected.")

        req_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        self._pending_rpc[req_id] = fut

        payload = {
            "id": req_id,
            "type": "rpc_request",
            "method": method,
            "params": params or {}
        }

        try:
            await pod.websocket.send_text(json.dumps(payload))
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending_rpc.pop(req_id, None)
            raise TimeoutError(f"RPC call '{method}' timed out after {timeout}s.")
        except Exception as e:
            self._pending_rpc.pop(req_id, None)
            raise e

    # Telemetry subscription
    def subscribe_telemetry(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self._telemetry_subscribers.add(q)
        return q

    def unsubscribe_telemetry(self, q: asyncio.Queue):
        self._telemetry_subscribers.discard(q)

    async def broadcast_telemetry(self, telemetry_data: dict):
        dead = []
        for q in self._telemetry_subscribers:
            try:
                q.put_nowait(telemetry_data)
            except asyncio.QueueFull:
                pass
            except Exception:
                dead.append(q)
        for q in dead:
            self._telemetry_subscribers.discard(q)

    # PTY listener management
    def register_pty_listener(self, session_id: str, on_output: Callable[[str], Any], on_exit: Optional[Callable[[int], Any]] = None, pod_id: Optional[str] = None):
        self._pty_listeners[session_id] = on_output
        if on_exit:
            self._pty_exit_listeners[session_id] = on_exit
        if pod_id:
            self._pty_pod_map[session_id] = pod_id

    def unregister_pty_listener(self, session_id: str):
        self._pty_listeners.pop(session_id, None)
        self._pty_exit_listeners.pop(session_id, None)
        self._pty_pod_map.pop(session_id, None)

    async def send_pty_input(self, session_id: str, data: str, pod_id: Optional[str] = None):
        target_pod_id = pod_id or self._pty_pod_map.get(session_id)
        pod = self.get_pod(target_pod_id)
        if not pod:
            return
        await pod.websocket.send_text(json.dumps({
            "type": "pty_input",
            "session_id": session_id,
            "data": data
        }))

    async def send_pty_resize(self, session_id: str, cols: int, rows: int, pod_id: Optional[str] = None):
        target_pod_id = pod_id or self._pty_pod_map.get(session_id)
        pod = self.get_pod(target_pod_id)
        if not pod:
            return
        await pod.websocket.send_text(json.dumps({
            "type": "pty_resize",
            "session_id": session_id,
            "cols": cols,
            "rows": rows
        }))

    async def send_pty_close(self, session_id: str, pod_id: Optional[str] = None):
        target_pod_id = pod_id or self._pty_pod_map.get(session_id)
        pod = self.get_pod(target_pod_id)
        if not pod:
            return
        await pod.websocket.send_text(json.dumps({
            "type": "pty_close",
            "session_id": session_id
        }))

agent_manager = AgentManager()
