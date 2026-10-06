from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

router = APIRouter(prefix="/api/network", tags=["network"])

class DiagnosticRequest(BaseModel):
    tool: str  # ping, dns, http
    target: str

@router.get("/interfaces")
async def get_network_interfaces(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("get_network_interfaces")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/diagnose")
async def run_network_diagnostic(req: DiagnosticRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    
    if req.tool not in ["ping", "dns", "http"]:
        raise HTTPException(status_code=400, detail="Invalid diagnostic tool")

    try:
        audit_logger.log(
            actor=user.get("username", "admin"),
            action="network.diagnose",
            resource=req.target,
            details={"tool": req.tool}
        )
        result = await agent_manager.call_rpc("network_diagnose", {
            "tool": req.tool,
            "target": req.target
        }, timeout=30.0)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
