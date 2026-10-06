# Cloud PC Control Plane — Rollback & Recovery Guide

## 1. Safety & Independence

The **Cloud PC Control Plane** in `C:\cloud-pc-control` is 100% isolated from the existing bridge in `C:\molab-gpu-bridge`:
- Uses its own dedicated port: `8800` (the existing bridge uses `8000`).
- Uses its own dedicated virtual environment: `C:\cloud-pc-control\.venv`.
- Uses its own configuration file: `C:\cloud-pc-control\.env`.
- Uses its own database: `C:\cloud-pc-control\data\audit.db`.

`C:\molab-gpu-bridge` was never modified or altered during the development of this platform.

---

## 2. Pre-Existing Bridge Backup

A complete backup of `C:\molab-gpu-bridge` was taken before development and is stored at:
`C:\molab-gpu-bridge-backup`

Backup manifest: `C:\molab-gpu-bridge-backup\backup_manifest.json`

---

## 3. Rollback Procedure

If you ever wish to completely remove or roll back the Control Plane:

### Step 1: Stop Running Processes
```powershell
cd C:\cloud-pc-control
.\stop-control-plane.ps1
```

### Step 2: Restore Original Bridge Configuration (If ever needed)
```powershell
powershell -ExecutionPolicy Bypass -File C:\molab-gpu-bridge-backup\rollback.ps1
```

### Step 3: Resume Existing Terminal Bridge
```powershell
cd C:\molab-gpu-bridge
.\start-bridge.ps1
```

The existing terminal bridge will resume listening on port 8000 immediately.
