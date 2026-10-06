# Cloud PC Control Plane — Security Architecture

## 1. Authentication & Session Management

- **Local Admin Authentication**:
  - The web interface requires authentication before accessing any API routes or WebSockets.
  - The admin username and cryptographically strong password (16+ URL-safe characters) are stored in `C:\cloud-pc-control\.env` with restricted local filesystem permissions.
  - Authentication checks use constant-time string comparison (`secrets.compare_digest`) to prevent timing side-channel attacks.
- **Session Tokens**:
  - Authenticated sessions issue a high-entropy 256-bit token (`secrets.token_urlsafe(32)`).
  - Sessions are transmitted via `HttpOnly`, `SameSite=Lax` cookies or `Authorization: Bearer <token>` headers.
  - Expired sessions (TTL: 24 hours) are evicted automatically.

---

## 2. Remote Agent Authorization

- **Dedicated Shared Secret**:
  - The remote agent connects to `/ws/agent` with a pre-shared 256-bit hex token (`AGENT_AUTH_TOKEN`).
  - Unauthenticated connections are rejected immediately with WebSocket code `1008 (Policy Violation)`.
  - Tokens are never logged or stored in telemetry payloads.

---

## 3. Filesystem Safety & Path Traversal Prevention

- **Protected System Root Paths**:
  - Dangerous paths (`/`, `/bin`, `/boot`, `/dev`, `/etc`, `/lib`, `/lib64`, `/proc`, `/sys`, `/usr`, `/sbin`, `C:\`, `C:\Windows`) cannot be deleted via the API.
  - Path normalization (`os.path.abspath`, `os.path.normpath`) is performed before every filesystem operation to prevent `..` path traversal vulnerabilities.
- **Upload & Download Safeguards**:
  - File upload limits are enforced on the backend.
  - Direct file inspection is capped at 5 MB to prevent server memory exhaustion.

---

## 4. Process & Command Isolation

- **No Arbitrary Unauthenticated Shell Execution**:
  - Shell execution is restricted exclusively to authenticated PTY sessions or explicit RPC actions.
  - Arbitrary unauthenticated shell endpoints do not exist.
- **Process Signals**:
  - Process termination is limited to explicit signals (`SIGTERM` = 15, `SIGKILL` = 9).
  - Process IDs `<= 1` (init / systemd) cannot be killed.

---

## 5. Audit Logging

- Every sensitive administrative event (login, logout, process kill, service control, file deletion, benchmark submission) is recorded in SQLite (`data/audit.db`).
- Records include UTC timestamp, actor identity, action type, target resource, outcome status, and origin IP address.
- The audit log can be viewed in the UI or queried via the API.
