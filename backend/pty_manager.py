import asyncio
import uuid
import time
import logging
from typing import Dict, Optional, Set
from fastapi import WebSocket
from backend.agent_manager import agent_manager

logger = logging.getLogger("pty_manager")

class TerminalSession:
    def __init__(self, session_id: str, is_remote: bool = True, cols: int = 80, rows: int = 24):
        self.session_id = session_id
        self.is_remote = is_remote
        self.cols = cols
        self.rows = rows
        self.created_at = time.time()
        self.scrollback: list[str] = []
        self.max_scrollback_chars = 100000
        self.browser_sockets: Set[WebSocket] = set()

    def append_output(self, text: str):
        self.scrollback.append(text)
        # Prune if too large
        total_len = sum(len(s) for s in self.scrollback)
        while total_len > self.max_scrollback_chars and len(self.scrollback) > 1:
            removed = self.scrollback.pop(0)
            total_len -= len(removed)

    def get_full_scrollback(self) -> str:
        return "".join(self.scrollback)


class PTYManager:
    def __init__(self):
        self.sessions: Dict[str, TerminalSession] = {}

    async def create_session(self, cols: int = 80, rows: int = 24) -> str:
        session_id = f"term-{uuid.uuid4().hex[:8]}"
        is_remote = agent_manager.is_online
        
        session = TerminalSession(session_id=session_id, is_remote=is_remote, cols=cols, rows=rows)
        self.sessions[session_id] = session

        if is_remote:
            try:
                await agent_manager.call_rpc("pty_open", {
                    "session_id": session_id,
                    "cols": cols,
                    "rows": rows,
                    "shell": "/bin/bash"
                }, timeout=10.0)
            except Exception as e:
                logger.error(f"Failed to open remote PTY: {e}")
                session.append_output(f"\r\n\x1b[31m[ERROR] Failed to open remote PTY: {e}\x1b[0m\r\n")

        # Register callback for remote output
        agent_manager.register_pty_listener(
            session_id,
            on_output=lambda data: asyncio.create_task(self.broadcast_output(session_id, data)),
            on_exit=lambda code: asyncio.create_task(self.handle_remote_exit(session_id, code))
        )

        return session_id

    async def attach_browser(self, session_id: str, websocket: WebSocket):
        if session_id not in self.sessions:
            # Auto-create if not found
            session = TerminalSession(session_id=session_id, is_remote=agent_manager.is_online)
            self.sessions[session_id] = session
            if agent_manager.is_online:
                try:
                    await agent_manager.call_rpc("pty_open", {
                        "session_id": session_id,
                        "cols": 80,
                        "rows": 24,
                        "shell": "/bin/bash"
                    })
                except Exception:
                    pass
            agent_manager.register_pty_listener(
                session_id,
                on_output=lambda data: asyncio.create_task(self.broadcast_output(session_id, data)),
                on_exit=lambda code: asyncio.create_task(self.handle_remote_exit(session_id, code))
            )
        
        session = self.sessions[session_id]
        session.browser_sockets.add(websocket)

        # Send existing scrollback buffer
        if session.scrollback:
            await websocket.send_text(session.get_full_scrollback())

    def detach_browser(self, session_id: str, websocket: WebSocket):
        if session_id in self.sessions:
            self.sessions[session_id].browser_sockets.discard(websocket)

    async def broadcast_output(self, session_id: str, data: str):
        if session_id not in self.sessions:
            return
        session = self.sessions[session_id]
        session.append_output(data)

        dead = []
        for ws in session.browser_sockets:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            session.browser_sockets.discard(ws)

    async def handle_remote_exit(self, session_id: str, exit_code: int):
        await self.broadcast_output(session_id, f"\r\n\x1b[33m[Session terminated with exit code {exit_code}]\x1b[0m\r\n")

    async def handle_input(self, session_id: str, data: str):
        if session_id in self.sessions:
            await agent_manager.send_pty_input(session_id, data)

    async def handle_resize(self, session_id: str, cols: int, rows: int):
        if session_id in self.sessions:
            session = self.sessions[session_id]
            session.cols = cols
            session.rows = rows
            await agent_manager.send_pty_resize(session_id, cols, rows)

    async def close_session(self, session_id: str):
        if session_id in self.sessions:
            await agent_manager.send_pty_close(session_id)
            agent_manager.unregister_pty_listener(session_id)
            del self.sessions[session_id]

pty_manager = PTYManager()
