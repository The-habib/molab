import sqlite3
import json
import datetime
from typing import Optional, List, Dict, Any
from backend.config import AUDIT_DB_PATH

class AuditLogger:
    def __init__(self, db_path=AUDIT_DB_PATH):
        self.db_path = str(db_path)
        self.init_db()

    def init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    action TEXT NOT NULL,
                    resource TEXT NOT NULL,
                    details TEXT,
                    status TEXT NOT NULL,
                    ip_address TEXT
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp DESC)")
            conn.commit()

    def log(
        self,
        actor: str,
        action: str,
        resource: str,
        details: Optional[Any] = None,
        status: str = "success",
        ip: Optional[str] = None
    ):
        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
        details_str = json.dumps(details) if details and not isinstance(details, str) else (details or "")
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_logs (timestamp, actor, action, resource, details, status, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (ts, actor, action, resource, details_str, status, ip or "127.0.0.1"))
            conn.commit()

    def get_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        action_filter: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = "SELECT id, timestamp, actor, action, resource, details, status, ip_address FROM audit_logs"
        conditions = []
        params = []

        if action_filter:
            conditions.append("action LIKE ?")
            params.append(f"%{action_filter}%")
        if status_filter:
            conditions.append("status = ?")
            params.append(status_filter)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def count_logs(self) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM audit_logs")
            return cursor.fetchone()[0]

audit_logger = AuditLogger()
