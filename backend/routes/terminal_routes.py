import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Response
from pydantic import BaseModel
from backend.auth import get_current_user, verify_websocket_user
from backend.pty_manager import pty_manager
from backend.audit import audit_logger

logger = logging.getLogger("terminal_routes")
router = APIRouter(prefix="/api/terminal", tags=["terminal"])

class CreateSessionRequest(BaseModel):
    cols: Optional[int] = 100
    rows: Optional[int] = 30

@router.post("/sessions")
async def create_terminal_session(req: CreateSessionRequest, user: dict = Depends(get_current_user)):
    session_id = await pty_manager.create_session(cols=req.cols, rows=req.rows)
    audit_logger.log(actor=user.get("username", "admin"), action="terminal.create", resource=session_id)
    return {"session_id": session_id}

@router.get("/sessions")
async def list_terminal_sessions(user: dict = Depends(get_current_user)):
    out = []
    for sid, sess in pty_manager.sessions.items():
        out.append({
            "session_id": sid,
            "created_at": sess.created_at,
            "cols": sess.cols,
            "rows": sess.rows,
            "is_remote": sess.is_remote,
            "browser_count": len(sess.browser_sockets)
        })
    return out

@router.delete("/sessions/{session_id}")
async def close_terminal_session(session_id: str, user: dict = Depends(get_current_user)):
    if session_id not in pty_manager.sessions:
        raise HTTPException(status_code=404, detail="Terminal session not found")
    await pty_manager.close_session(session_id)
    audit_logger.log(actor=user.get("username", "admin"), action="terminal.close", resource=session_id)
    return {"status": "closed"}

@router.get("/sessions/{session_id}/scrollback")
async def get_scrollback(session_id: str, user: dict = Depends(get_current_user)):
    if session_id not in pty_manager.sessions:
        raise HTTPException(status_code=404, detail="Terminal session not found")
    text = pty_manager.sessions[session_id].get_full_scrollback()
    return Response(
        content=text,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={session_id}_scrollback.txt"}
    )

class TerminalInputRequest(BaseModel):
    input: str

@router.post("/sessions/{session_id}/input")
async def send_session_input(session_id: str, req: TerminalInputRequest, user: dict = Depends(get_current_user)):
    if session_id not in pty_manager.sessions:
        raise HTTPException(status_code=404, detail="Terminal session not found")
    await pty_manager.handle_input(session_id, req.input)
    return {"status": "ok"}

@router.websocket("/ws/{session_id}")
async def terminal_websocket(websocket: WebSocket, session_id: str):
    user = await verify_websocket_user(websocket)
    if not user:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    await websocket.accept()
    await pty_manager.attach_browser(session_id, websocket)

    try:
        while True:
            msg = await websocket.receive_text()
            # Check if this is a structured resize message
            if msg.startswith("{") and "resize" in msg:
                try:
                    parsed = json.loads(msg)
                    if parsed.get("type") == "resize":
                        await pty_manager.handle_resize(session_id, parsed.get("cols", 80), parsed.get("rows", 24))
                        continue
                except Exception:
                    pass
            # Regular stdin stream
            await pty_manager.handle_input(session_id, msg)

    except WebSocketDisconnect:
        logger.info(f"Terminal websocket disconnected for {session_id}")
    finally:
        pty_manager.detach_browser(session_id, websocket)
