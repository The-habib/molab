# Cloud PC Control Plane Stopper
# Stops all running control plane and tunnel processes

$ErrorActionPreference = "SilentlyContinue"

$ProjectRoot = "C:\cloud-pc-control"
$PidFile = "$ProjectRoot\.control_plane_pids.json"
$RuntimeFile = "$ProjectRoot\tunnel_runtime.json"

Write-Host "Stopping Cloud PC Control Plane processes..." -ForegroundColor Cyan

if (Test-Path $PidFile) {
    try {
        $pids = Get-Content $PidFile | ConvertFrom-Json
        if ($pids.backend_pid) {
            Stop-Process -Id $pids.backend_pid -Force
            Write-Host "  Stopped Backend (PID: $($pids.backend_pid))" -ForegroundColor Green
        }
        if ($pids.tunnel_pid) {
            Stop-Process -Id $pids.tunnel_pid -Force
            Write-Host "  Stopped Tunnel Manager (PID: $($pids.tunnel_pid))" -ForegroundColor Green
        }
    } catch {
        Write-Warning "Could not read PID file: $_"
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# Also ensure any lingering python processes on port 8800 or cloudflared instances from this directory are stopped
$conns = Get-NetTCPConnection -LocalPort 8800 -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    if ($c.OwningProcess -gt 0) {
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "  Terminated process on port 8800 (PID: $($c.OwningProcess))" -ForegroundColor Green
    }
}

if (Test-Path $RuntimeFile) {
    Remove-Item $RuntimeFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Control plane stopped cleanly." -ForegroundColor Green
