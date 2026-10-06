from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

router = APIRouter(prefix="/api/system", tags=["system"])

class SystemActionRequest(BaseModel):
    action: str  # clear_tmp, restart_agent, reboot

@router.get("/info")
async def get_system_info(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("get_system_info")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/action")
async def execute_system_action(req: SystemActionRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")

    if req.action not in ["clear_tmp", "restart_agent", "reboot"]:
        raise HTTPException(status_code=400, detail="Invalid system action")

    try:
        audit_logger.log(
            actor=user.get("username", "admin"),
            action=f"system.{req.action}",
            resource="cloud_pc"
        )
        result = await agent_manager.call_rpc("system_action", {"action": req.action})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/env")
async def get_env_vars(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("get_env_vars")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
