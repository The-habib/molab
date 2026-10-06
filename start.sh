#!/usr/bin/env bash
# Cloud PC Control Plane - Linux / macOS / WSL Launcher
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================================"
echo "       CLOUD PC CONTROL PLANE - AUTONOMOUS LAUNCHER (UNIX/MAC/WSL)      "
echo "========================================================================"
echo ""

# 1. Check Python
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 is not installed or not in PATH."
    exit 1
fi

# 2. Check / initialize virtual environment
if [ ! -f ".venv/bin/python" ]; then
    echo "[*] Creating virtual environment in .venv..."
    python3 -m venv .venv
    echo "[OK] Virtual environment created."
fi

PYTHON_EXE=".venv/bin/python"

# 3. Run CLI
"$PYTHON_EXE" -u cli.py "$@"
