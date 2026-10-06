# PowerShell launcher for Cloud PC Control Plane
# Starts backend and Cloudflare Quick Tunnel

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Starting Cloud PC Control Plane (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Locate Python in .venv
$PythonExe = Join-Path $ScriptDir ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python.exe"
}

# Run control plane runner
& $PythonExe -u run_control_plane.py
