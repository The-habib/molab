from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

router = APIRouter(prefix="/api/containers", tags=["containers"])

class ContainerActionRequest(BaseModel):
    action: str  # start, stop, restart

@router.get("")
async def list_containers(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("list_containers")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{container_id}/action")
async def container_action(container_id: str, req: ContainerActionRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    
    if req.action not in ["start", "stop", "restart"]:
        raise HTTPException(status_code=400, detail="Invalid container action")

    try:
        result = await agent_manager.call_rpc("control_container", {"container_id": container_id, "action": req.action})
        audit_logger.log(
            actor=user.get("username", "admin"),
            action=f"container.{req.action}",
            resource=container_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
