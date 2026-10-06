# Cloud PC Control Plane — Operations Guide

## 1. Starting the Service

To start the Control Plane backend and Cloudflare tunnel:
```powershell
cd C:\cloud-pc-control
.\start-control-plane.ps1
```

Expected Output:
```text
============================================================
       STARTING CLOUD PC CONTROL PLANE DASHBOARD           
============================================================
[1/3] Starting Control Plane Backend on http://127.0.0.1:8800...
  [OK] Backend healthy: ok
[2/3] Starting Cloudflare Quick Tunnel for remote MoLab worker...

[3/3] Control Plane is Ready!
============================================================
LOCAL DASHBOARD:       http://127.0.0.1:8800
ADMIN USERNAME:        admin
ADMIN PASSWORD:        <generated-admin-password>
------------------------------------------------------------
PUBLIC HTTPS URL:      https://<subdomain>.trycloudflare.com
MOLAB AGENT WSS URL:   wss://<subdomain>.trycloudflare.com/ws/agent
AGENT AUTH TOKEN:      <generated-agent-token>
============================================================
```

---

## 2. Stopping the Service

To stop all running processes:
```powershell
cd C:\cloud-pc-control
.\stop-control-plane.ps1
```

---

## 3. Connecting MoLab Pod

In your MoLab notebook:
```python
# 1. Install dependencies
!pip install -q websockets psutil

# 2. Run agent
from agent.molab_notebook_cell import start_agent_in_background
start_agent_in_background(
    wss_url="wss://<your-subdomain>.trycloudflare.com/ws/agent",
    token="<your-agent-auth-token>"
)
```

The Windows dashboard at `http://127.0.0.1:8800` will immediately transition to `ONLINE` and display real-time telemetry and GPU specifications for the NVIDIA RTX PRO 6000 Blackwell.

---

## 4. Secret Rotation

To rotate passwords or tokens:
1. Stop the control plane: `.\stop-control-plane.ps1`
2. Edit `C:\cloud-pc-control\.env` and change `ADMIN_PASSWORD` or `AGENT_AUTH_TOKEN`.
3. Restart: `.\start-control-plane.ps1`.
4. Update the token in your MoLab notebook.
