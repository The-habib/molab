from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.auth import get_current_user
from backend.agent_manager import agent_manager

router = APIRouter(prefix="/api/logs", tags=["logs"])

@router.get("/sources")
async def get_log_sources(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("get_log_sources")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/tail")
async def tail_log(
    source: str = Query(default="syslog"),
    lines: int = Query(default=100),
    user: dict = Depends(get_current_user)
):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("tail_log", {"source": source, "lines": lines})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
