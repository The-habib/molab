from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.job_manager import job_manager

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

class SubmitJobRequest(BaseModel):
    name: str
    type: str
    payload: Optional[Dict[str, Any]] = None

@router.get("")
async def list_jobs(user: dict = Depends(get_current_user)):
    return job_manager.list_jobs()

@router.post("")
async def submit_job(req: SubmitJobRequest, user: dict = Depends(get_current_user)):
    job = await job_manager.submit_job(
        name=req.name,
        job_type=req.type,
        payload=req.payload or {},
        owner=user.get("username", "admin")
    )
    return job.to_dict()

@router.get("/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    data = job.to_dict()
    data["logs"] = job.logs
    return data

@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str, user: dict = Depends(get_current_user)):
    success = await job_manager.cancel_job(job_id, actor=user.get("username", "admin"))
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel job (not found or already finished)")
    return {"status": "cancelled"}
