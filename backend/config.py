import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Auto-generate .env if not present
if not ENV_PATH.exists():
    admin_pw = secrets.token_urlsafe(16)
    session_secret = secrets.token_hex(32)
    agent_token = secrets.token_hex(32)
    
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write("# Cloud PC Control Plane Environment Configuration\n")
        f.write("HOST=127.0.0.1\n")
        f.write("PORT=8800\n")
        f.write(f"ADMIN_USERNAME=admin\n")
        f.write(f"ADMIN_PASSWORD={admin_pw}\n")
        f.write(f"ADMIN_SESSION_SECRET={session_secret}\n")
        f.write(f"AGENT_AUTH_TOKEN={agent_token}\n")
        f.write("LOG_LEVEL=INFO\n")

load_dotenv(ENV_PATH)

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8800"))
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
ADMIN_SESSION_SECRET = os.getenv("ADMIN_SESSION_SECRET", "")
AGENT_AUTH_TOKEN = os.getenv("AGENT_AUTH_TOKEN", "")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
AUDIT_DB_PATH = DATA_DIR / "audit.db"
STATIC_DIR = BASE_DIR / "frontend" / "dist"
