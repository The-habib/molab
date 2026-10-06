# Cloud PC Control Plane — Troubleshooting Guide

## 1. Port 8800 Already in Use

**Symptom**: `Backend failed to start on port 8800: Address already in use.`
**Resolution**:
Run `.\stop-control-plane.ps1` to terminate any existing process occupying port 8800.
Or check manually:
```powershell
Get-NetTCPConnection -LocalPort 8800 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

---

## 2. Cloudflare Tunnel Fails to Generate URL

**Symptom**: `Cloudflare Quick Tunnel failed to generate URL within timeout.`
**Resolution**:
1. Check internet connectivity on Windows.
2. Run `cloudflared tunnel diag` to verify DNS and outbound UDP/TCP connection to Cloudflare edge nodes.
3. Test manually:
   ```powershell
   cloudflared tunnel --url http://127.0.0.1:8800
   ```

---

## 3. Remote MoLab Agent Cannot Connect

**Symptom**: Agent displays `Connection lost or failed (403 or 1008)`.
**Resolution**:
1. Verify `MOLAB_AGENT_AUTH_TOKEN` matches `AGENT_AUTH_TOKEN` in `C:\cloud-pc-control\.env`.
2. Ensure the URL starts with `wss://` (not `http://` or `ws://` when going over Cloudflare tunnel).
3. Ensure the path is `/ws/agent`.

---

## 4. Terminal Displays Blank Screen

**Symptom**: Terminal tab is opened, but no shell prompt appears.
**Resolution**:
1. Check if the remote cloud PC is marked `ONLINE` in the top bar. If offline, the terminal cannot spawn a remote PTY.
2. Verify `/bin/bash` or `/bin/sh` exists on the remote system.
3. Click "Clear" or open a new terminal tab.
