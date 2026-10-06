import asyncio
import json
import time
import uuid
import logging
from typing import Dict, Optional, Any, Callable, Set
from fastapi import WebSocket

logger = logging.getLogger("agent_manager")

class AgentManager:
    def __init__(self):
        self.connected_agent_ws: Optional[WebSocket] = None
        self.agent_info: Dict[str, Any] = {}
        self.last_heartbeat: float = 0.0
        self.latency_ms: float = 0.0
        self.latest_telemetry: Dict[str, Any] = {}
        self._pending_rpc: Dict[str, asyncio.Future] = {}
        self._telemetry_subscribers: Set[asyncio.Queue] = set()
        self._pty_listeners: Dict[str, Callable[[str], Any]] = {} # session_id -> callback(data)
        self._pty_exit_listeners: Dict[str, Callable[[int], Any]] = {}

    @property
    def is_online(self) -> bool:
        if not self.connected_agent_ws:
            return False
        # If no heartbeat for > 45 seconds, mark offline
        return (time.time() - self.last_heartbeat) < 45.0

    async def register_agent(self, websocket: WebSocket, registration_data: dict) -> dict:
        self.connected_agent_ws = websocket
        self.agent_info = registration_data
        self.last_heartbeat = time.time()
        logger.info(f"Remote Agent registered: {registration_data.get('hostname', 'unknown')} ({registration_data.get('os', 'unknown')})")
        return {"status": "registered", "server_time": time.time()}

    def disconnect_agent(self):
        logger.warning("Remote Agent disconnected.")
        self.connected_agent_ws = None
        # Cancel any pending RPCs
        for req_id, fut in list(self._pending_rpc.items()):
            if not fut.done():
                fut.set_exception(ConnectionError("Agent disconnected while waiting for RPC response"))
        self._pending_rpc.clear()

    async def handle_agent_message(self, message_str: str):
        try:
            msg = json.loads(message_str)
        except Exception as e:
            logger.error(f"Failed to parse agent message: {e}")
            return

        msg_type = msg.get("type")

        # 1. Heartbeat
        if msg_type == "heartbeat":
            self.last_heartbeat = time.time()
            send_ts = msg.get("timestamp", 0)
            if send_ts > 0:
                self.latency_ms = max(0.0, (time.time() - send_ts) * 1000.0)
            if "telemetry" in msg:
                self.latest_telemetry = msg["telemetry"]
                await self.broadcast_telemetry(self.latest_telemetry)
            if self.connected_agent_ws:
                await self.connected_agent_ws.send_text(json.dumps({
                    "type": "heartbeat_ack",
                    "timestamp": time.time()
                }))

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

    async def call_rpc(self, method: str, params: Optional[dict] = None, timeout: float = 30.0) -> Any:
        if not self.is_online:
            raise ConnectionError("Remote Cloud PC is offline or not connected.")
        if not self.connected_agent_ws:
            raise ConnectionError("No active agent WebSocket connection.")

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
            await self.connected_agent_ws.send_text(json.dumps(payload))
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
    def register_pty_listener(self, session_id: str, on_output: Callable[[str], Any], on_exit: Optional[Callable[[int], Any]] = None):
        self._pty_listeners[session_id] = on_output
        if on_exit:
            self._pty_exit_listeners[session_id] = on_exit

    def unregister_pty_listener(self, session_id: str):
        self._pty_listeners.pop(session_id, None)
        self._pty_exit_listeners.pop(session_id, None)

    async def send_pty_input(self, session_id: str, data: str):
        if not self.connected_agent_ws:
            return
        await self.connected_agent_ws.send_text(json.dumps({
            "type": "pty_input",
            "session_id": session_id,
            "data": data
        }))

    async def send_pty_resize(self, session_id: str, cols: int, rows: int):
        if not self.connected_agent_ws:
            return
        await self.connected_agent_ws.send_text(json.dumps({
            "type": "pty_resize",
            "session_id": session_id,
            "cols": cols,
            "rows": rows
        }))

    async def send_pty_close(self, session_id: str):
        if not self.connected_agent_ws:
            return
        await self.connected_agent_ws.send_text(json.dumps({
            "type": "pty_close",
            "session_id": session_id
        }))

agent_manager = AgentManager()
