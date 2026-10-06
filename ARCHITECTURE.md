# Cloud PC Control Plane — Architecture Specification

## 1. System Overview

The **Cloud PC Control Plane** is designed to provide visual management, real-time monitoring, and administrative access to remote cloud compute machines (such as MoLab containerized GPU pods, Kaggle, or custom cloud instances) from a local Windows PC without requiring inbound ports or public IP addresses on the remote pod.

---

## 2. Network Topology & Communication Flow

```
+-------------------------------------------------------------------------+
|                              LOCAL BROWSER                              |
|   (Dashboard, xterm.js Terminal, Files, Processes, GPU Center, Audit)   |
+-------------------------------------------------------------------------+
                                   ▲
                                   │ HTTP (REST) & WSS (Realtime Streams)
                                   ▼
+-------------------------------------------------------------------------+
|                 WINDOWS CONTROL PLANE (127.0.0.1:8800)                  |
|  - FastAPI Backend / Uvicorn Server                                     |
|  - In-Memory Session & Terminal PTY Bridge                              |
|  - SQLite Persistent Audit Database (data/audit.db)                     |
|  - Static Single-Page Application Host (dist/index.html)                |
+-------------------------------------------------------------------------+
                                   ▲
                                   │ Local Proxying
                                   ▼
+-------------------------------------------------------------------------+
|                  CLOUDFLARE QUICK TUNNEL (cloudflared)                  |
|  - Ingress Endpoint: https://<subdomain>.trycloudflare.com              |
|  - TLS Termination on Cloudflare Edge (Port 443)                        |
+-------------------------------------------------------------------------+
                                   ▲
                                   │ Outbound HTTPS / WSS (Port 443)
                                   │ (MoLab initiates connection)
                                   ▼
+-------------------------------------------------------------------------+
|                       REMOTE CLOUD PC / MOLAB POD                       |
|  - Hardware: NVIDIA RTX PRO 6000 Blackwell Server Edition (94.97 GB)    |
|  - Software: Linux, PyTorch 2.11+cu130, CUDA 13.0                       |
|  - Autonomous Python Agent (molab_agent.py)                             |
|  - Native POSIX PTY Master (os.openpty, fcntl TIOCSWINSZ)               |
+-------------------------------------------------------------------------+
```

---

## 3. Core Architectural Principles

1. **Zero Inbound Ports on Remote Compute**:
   MoLab pods and containerized cloud instances reside behind NAT and firewall boundaries that prevent direct inbound connections. The remote agent initiates outbound HTTPS/WSS connections over port 443 to Cloudflare, eliminating the need for open inbound ports, port forwarding, or public IPs on the compute instance.

2. **Real Interactive PTY vs. Command Emulation**:
   Terminal sessions are backed by real POSIX pseudo-terminals (`os.openpty()`) running `/bin/bash` with environment variables (`TERM=xterm-256color`, `COLORTERM=truecolor`). Window resize signals (`TIOCSWINSZ`) and control characters (`Ctrl+C`, `Tab`, `Arrow keys`, `ANSI escape sequences`) are propagated transparently to xterm.js.

3. **Strict Separation of Concerns**:
   The Control Plane is completely isolated in `C:\cloud-pc-control` on port 8800 and does not modify or interfere with the existing worker bridge in `C:\molab-gpu-bridge` (which runs on port 8000).

4. **Synchronous Heartbeat & Asynchronous RPC**:
   The remote agent continuously streams system metrics every 3 seconds to the control plane, updating connected browsers over WebSocket. Interactive commands (file reading, writing, process killing, systemd commands) use asynchronous request-response correlation IDs over the same persistent WebSocket channel.

5. **Safe Failures & Reconnection**:
   If network connectivity drops between MoLab and Cloudflare, the agent automatically retries with exponential backoff and jitter. PTY scrollback buffers are preserved on the control plane so browser reconnections restore previous output without loss.
