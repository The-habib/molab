from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from backend.auth import get_current_user
from backend.agent_manager import agent_manager

router = APIRouter(prefix="/api/storage", tags=["storage"])

@router.get("/disks")
async def get_storage_disks(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("get_storage_disks")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/analyze")
async def analyze_storage(path: str = Query(default="/workspace"), user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("analyze_storage", {"path": path})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
