from fastapi import APIRouter, HTTPException, Depends, Response, status
from pydantic import BaseModel
from backend.auth import (
    verify_admin_credentials,
    create_session,
    terminate_session,
    get_current_user
)
from backend.audit import audit_logger

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    username: str
    expires_in: int

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, response: Response):
    if not verify_admin_credentials(req.username, req.password):
        audit_logger.log(actor=req.username, action="auth.login", resource="control_plane", status="failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    session_id = create_session(req.username)
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=86400
    )
    
    audit_logger.log(actor=req.username, action="auth.login", resource="control_plane", status="success")
    return LoginResponse(token=session_id, username=req.username, expires_in=86400)

@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie(key="session_id")
    audit_logger.log(actor=user.get("username", "unknown"), action="auth.logout", resource="control_plane")
    return {"status": "logged_out"}

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "authenticated": True,
        "username": user.get("username"),
        "expires_at": user.get("expires_at")
    }
