from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

router = APIRouter(prefix="/api/services", tags=["services"])

class ServiceActionRequest(BaseModel):
    action: str  # start, stop, restart, enable, disable

@router.get("")
async def list_services(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("list_services")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{name}/action")
async def service_action(name: str, req: ServiceActionRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    
    if req.action not in ["start", "stop", "restart", "enable", "disable"]:
        raise HTTPException(status_code=400, detail="Invalid service action")

    try:
        result = await agent_manager.call_rpc("control_service", {"service_name": name, "action": req.action})
        audit_logger.log(
            actor=user.get("username", "admin"),
            action=f"service.{req.action}",
            resource=name
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
