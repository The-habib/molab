import os
import base64
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response
from pydantic import BaseModel
from backend.auth import get_current_user
from backend.agent_manager import agent_manager
from backend.audit import audit_logger

router = APIRouter(prefix="/api/files", tags=["files"])

CRITICAL_PATHS = ["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/sys", "/usr", "/sbin", "c:\\", "c:\\windows", "c:"]

class WriteFileRequest(BaseModel):
    path: str
    content: str

class MkdirRequest(BaseModel):
    path: str

class RenameRequest(BaseModel):
    src: str
    dst: str

@router.get("/list")
async def list_files(path: str = Query(default="/workspace"), user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("list_files", {"path": path})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/read")
async def read_file(path: str = Query(...), user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("read_file", {"path": path})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/write")
async def write_file(req: WriteFileRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("write_file", {"path": req.path, "content": req.content})
        audit_logger.log(actor=user.get("username", "admin"), action="file.write", resource=req.path)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/mkdir")
async def create_directory(req: MkdirRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("mkdir", {"path": req.path})
        audit_logger.log(actor=user.get("username", "admin"), action="file.mkdir", resource=req.path)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/rename")
async def rename_file(req: RenameRequest, user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("rename", {"src": req.src, "dst": req.dst})
        audit_logger.log(actor=user.get("username", "admin"), action="file.rename", resource=f"{req.src} -> {req.dst}")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/delete")
async def delete_file(path: str = Query(...), user: dict = Depends(get_current_user)):
    cleaned = path.strip().replace("\\", "/").rstrip("/").lower()
    if cleaned in ["", "/", *[p.replace("\\", "/").rstrip("/").lower() for p in CRITICAL_PATHS]]:
        raise HTTPException(status_code=403, detail="Deleting system-critical root paths is forbidden")

    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("delete_file", {"path": path})
        audit_logger.log(actor=user.get("username", "admin"), action="file.delete", resource=path)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload")
async def upload_file(
    path: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        content_bytes = await file.read()
        b64_content = base64.b64encode(content_bytes).decode("ascii")
        target_path = os.path.join(path, file.filename).replace("\\", "/")
        
        result = await agent_manager.call_rpc("upload_file", {
            "path": target_path,
            "b64_content": b64_content
        })
        audit_logger.log(actor=user.get("username", "admin"), action="file.upload", resource=target_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/download")
async def download_file(path: str = Query(...), user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        result = await agent_manager.call_rpc("download_file", {"path": path})
        b64_data = result.get("b64_content", "")
        data = base64.b64decode(b64_data)
        filename = os.path.basename(path) or "download"
        return Response(
            content=data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/clean_pycache")
async def clean_pycache(path: str = Query(default="/marimo"), user: dict = Depends(get_current_user)):
    if not agent_manager.is_online:
        raise HTTPException(status_code=503, detail="Remote Cloud PC is offline")
    try:
        audit_logger.log(actor=user.get("username", "admin"), action="file.clean_pycache", resource=path)
        result = await agent_manager.call_rpc("clean_pycache", {"path": path})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
