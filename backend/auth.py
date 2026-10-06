import time
import secrets
from typing import Dict, Optional
from fastapi import Request, HTTPException, Depends, status, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD, AGENT_AUTH_TOKEN
from backend.audit import audit_logger

security_bearer = HTTPBearer(auto_error=False)

# In-memory session store: session_id -> { "username": str, "created_at": float, "expires_at": float }
ACTIVE_SESSIONS: Dict[str, dict] = {}
SESSION_TTL_SECONDS = 86400  # 24 hours

def create_session(username: str) -> str:
    now = time.time()
    session_id = secrets.token_urlsafe(32)
    ACTIVE_SESSIONS[session_id] = {
        "username": username,
        "created_at": now,
        "expires_at": now + SESSION_TTL_SECONDS
    }
    return session_id

def validate_session(session_id: str) -> Optional[dict]:
    if not session_id or session_id not in ACTIVE_SESSIONS:
        return None
    sess = ACTIVE_SESSIONS[session_id]
    if time.time() > sess["expires_at"]:
        del ACTIVE_SESSIONS[session_id]
        return None
    return sess

def terminate_session(session_id: str):
    if session_id in ACTIVE_SESSIONS:
        del ACTIVE_SESSIONS[session_id]

def verify_admin_credentials(username: str, password: str) -> bool:
    if not secrets.compare_digest(username.strip(), ADMIN_USERNAME.strip()):
        return False
    if not secrets.compare_digest(password.strip(), ADMIN_PASSWORD.strip()):
        return False
    return True

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)
) -> dict:
    session_id = None
    
    # Check Bearer header
    if credentials and credentials.scheme.lower() == "bearer":
        session_id = credentials.credentials
        
    # Check Cookie fallback
    if not session_id:
        session_id = request.cookies.get("session_id")
        
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
        
    sess = validate_session(session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalid or expired"
        )
        
    return sess

async def verify_websocket_user(websocket: WebSocket) -> Optional[dict]:
    # Check token in query param
    token = websocket.query_params.get("token")
    if not token:
        # Check cookie
        token = websocket.cookies.get("session_id")
        
    if not token:
        return None
        
    return validate_session(token)

def verify_agent_token(token: str) -> bool:
    if not token or not AGENT_AUTH_TOKEN:
        return False
    return secrets.compare_digest(token.strip(), AGENT_AUTH_TOKEN.strip())
