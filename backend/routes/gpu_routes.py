from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

router = APIRouter(prefix="/api/gpu", tags=["gpu"])

class BenchmarkRequest(BaseModel):
    matrix_size: Optional[int] = 4096
    iterations: Optional[int] = 10

@router.get("/telemetry")
async def get_gpu_telemetry(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("get_gpu_telemetry")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/benchmark")
async def run_gpu_benchmark(req: BenchmarkRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        audit_logger.log(
            actor=user.get("username", "admin"),
            action="gpu.benchmark",
            resource="RTX PRO 6000 Blackwell",
            details={"matrix_size": req.matrix_size, "iterations": req.iterations}
        )
        result = await agent_manager.call_rpc("run_gpu_benchmark", {
            "matrix_size": req.matrix_size,
            "iterations": req.iterations
        }, timeout=60.0)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/purge_cache")
async def purge_gpu_cache(user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        audit_logger.log(actor=user.get("username", "admin"), action="gpu.purge_cache", resource="RTX PRO 6000 Blackwell")
        result = await agent_manager.call_rpc("purge_gpu_cache")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
