from typing import Optional
from fastapi import APIRouter, Depends, Query
from backend.auth import get_current_user
from backend.audit import audit_logger

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/logs")
async def get_audit_logs(
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    action: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    logs = audit_logger.get_logs(limit=limit, offset=offset, action_filter=action, status_filter=status)
    total = audit_logger.count_logs()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "logs": logs
    }
