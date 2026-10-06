from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

router = APIRouter(prefix="/api/processes", tags=["processes"])

class KillProcessRequest(BaseModel):
    signal: Optional[int] = 15  # SIGTERM default, 9 for SIGKILL

@router.get("")
async def list_processes(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("list_processes")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{pid}/kill")
async def kill_process(pid: int, req: KillProcessRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("kill_process", {"pid": pid, "signal": req.signal})
        audit_logger.log(
            actor=user.get("username", "admin"),
            action="process.kill",
            resource=f"PID {pid}",
            details={"signal": req.signal}
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
