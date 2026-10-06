@echo off
setlocal enabledelayedexpansion

title Cloud PC Control Plane - Global Autonomous CLI
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" cli.py %*
if %ERRORLEVEL% neq 0 (
    pause
)
