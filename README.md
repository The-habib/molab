# MoLab: Autonomous Cloud PC Control Plane & Remote GPU Bridge

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.0.0-00f0ff?style=for-the-badge&logo=rocket" alt="Release v1.0.0" />
  <img src="https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12%20%7C%203.13-3776ab?style=for-the-badge&logo=python" alt="Python 3.10+" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-informational?style=for-the-badge&logo=linux" alt="Cross-Platform" />
  <img src="https://img.shields.io/badge/GPU-NVIDIA%20Blackwell%20Architecture-76b900?style=for-the-badge&logo=nvidia" alt="NVIDIA Blackwell" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License: MIT" />
</p>

---

## 🚀 Overview

**MoLab** is an enterprise-grade, browser-based **Autonomous Control Plane & High-Performance GPU Bridge** designed to link local workstations (Windows, macOS, Linux) directly to remote high-performance compute instances (MoLab, Google Colab, RunPod, Lambda Labs, or private cloud servers).

Equipped with an interactive **xterm.js Web PTY terminal**, real-time **hardware telemetry** (CPU, RAM, Disk, Net), an advanced **NVIDIA Blackwell GPU Center** (tested on NVIDIA RTX PRO 6000 Blackwell 94.97 GB VRAM), an integrated **file explorer & code editor**, and **zero-config Cloudflare TLS tunneling**, MoLab allows you to control remote compute pods anywhere in the world through a single, autonomous command.

---

## 🌟 Key Features

### 🖥️ 1. Ultra-Low Latency Telemetry Dashboard
* **Real-Time System Vitals**: Continuous streaming of CPU load, memory utilization, disk storage, and network throughput (RX/TX KB/s) via WebSockets.
* **Transient Memory Metrics**: Zero overhead; live updates without database bloat or aggressive polling loops.

### ⚡ 2. NVIDIA Blackwell GPU Command Center
* **Complete Hardware Telemetry**: Live VRAM metrics, core utilization, power draw (W), thermals (°C), fan speed, and clock rates.
* **Blackwell Architecture Optimization**: Native support for RTX PRO 6000 Blackwell Server Edition (94.97 GB VRAM) running PyTorch 2.11 and CUDA 13.0.
* **On-Demand TFLOPS Matrix Benchmarks**: Run asynchronous deep-learning matrix multiplication benchmarks and track real-time FP32/BF16/FP16 performance.

### 💻 3. Interactive Web PTY Terminal (xterm.js)
* **Real Pseudo-Terminal**: Executes true `/bin/bash` or `cmd.exe` sessions with full ANSI color graphics, cursor positioning, and dynamic window resizing (`TIOCSWINSZ`).
* **Multi-Tab Workspaces**: Open multiple concurrent terminal sessions simultaneously.
* **Session Management**: Full scrollback preservation, interrupt handling (`Ctrl+C`), and instant log exports.

### 📁 4. Visual File Explorer & In-Browser Code Editor
* **Breadcrumb Navigation**: Seamlessly navigate remote directory trees.
* **In-Browser IDE**: View, edit, and save scripts (`.py`, `.sh`, `.json`, `.yaml`) directly from the browser with line numbers and syntax formatting.
* **Safe Transfers**: Upload files directly to the remote pod, download datasets or checkpoints, and execute safe deletions with built-in system protection guards.

### ⚙️ 5. Process & Service Orchestration
* **Live Process Inspector**: View active processes sorted by CPU and Memory usage with PID, user, and full command arguments.
* **Signal Dispatcher**: Terminate unresponsive jobs gracefully via `SIGTERM` or forcefully via `SIGKILL`.
* **System Services**: Inspect and control systemd service states on remote hosts.

### 🌐 6. Autonomous Cloudflare Tunnel Provisioning
* **Zero Port-Forwarding**: Securely exposes your local control plane over encrypted public HTTPS/WSS (`*.trycloudflare.com`).
* **Cross-Platform Auto-Installer**: The tunnel engine automatically detects your host OS (Windows, Linux, macOS) and downloads the verified `cloudflared` binary if not present.

### ⌨️ 7. Unified Global CLI & One-Liner Pod Connection
* **Autonomous Pod Connection**: Generates an all-in-one terminal command that connects any remote pod in seconds with zero manual configuration.
* **Global CLI**: Manage your entire infrastructure with `cloudpc` and `molab` CLI commands.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│               WEB BROWSER (ANY DEVICE)                 │
│  React 18 + TypeScript + Vite + TailwindCSS + xterm.js │
└───────────────────────────┬────────────────────────────┘
                            │  HTTPS / WSS (Port 8800)
                            ▼
┌────────────────────────────────────────────────────────┐
│             LOCAL CONTROL PLANE SERVER                 │
│         (Windows, macOS, Linux, or Cloud VM)           │
│                                                        │
│  ├─ FastAPI ASGI Server (backend/main.py)              │
│  ├─ Static Single-Page App (SPA) Engine                │
│  ├─ WebSocket Dispatcher & Telemetry Hub               │
│  ├─ Async PTY Terminal Bridge                          │
│  ├─ SQLite Security & Audit Trail                      │
│  └─ Cloudflare Tunnel Ingress Engine                   │
└──────────────┬───────────────────────────▲─────────────┘
               │                           │
               │ Outbound TLS (WSS 443)    │ Bidirectional Stream
               ▼                           │ (Telemetry & Commands)
┌──────────────────────────────────────────┴─────────────┐
│             REMOTE POD / WORKER INSTANCE               │
│        (MoLab, Google Colab, RunPod, Linux Pod)        │
│                                                        │
│  ├─ Autonomous Agent (agent/molab_single_cell_complete)│
│  ├─ Real Linux PTY Pseudo-Terminal Fork                │
│  ├─ NVIDIA Blackwell GPU Telemetry (NVML / PyTorch)    │
│  ├─ Local Filesystem & Process Operations              │
│  └─ Asynchronous Task & Benchmark Executor             │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/The-habib/molab.git
cd molab

# Create virtual environment
python -m venv .venv

# Activate virtual environment:
# On Linux / macOS:
source .venv/bin/activate
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r requirements.txt

# (Optional) Install global CLI entry points:
pip install -e .
```

### 2. Configure Environment

Copy the example configuration:
```bash
cp .env.example .env
```
Default credentials are pre-configured for instant development (`admin` / `Habib0000`).

---

### 3. Start the Control Plane

You can start the control plane using your preferred method:

#### Using the Global CLI:
```bash
molab start
# or:
cloudpc start
```

#### On Windows (PowerShell):
```powershell
.\start-control-plane.ps1
```

#### On Linux / macOS / WSL (Bash):
```bash
chmod +x start.sh
./start.sh
```

The server will start on `http://127.0.0.1:8800` and automatically establish a secure Cloudflare TLS Tunnel.

---

### 4. Connect Your Remote Pod (A-to-Z Command)

To connect any remote MoLab instance, Google Colab container, RunPod pod, or remote Linux terminal:

#### Option A: The One-Liner Autonomous Installer (Recommended)
Simply paste this command into your remote pod's terminal:
```bash
curl -fsSL https://<your-tunnel-subdomain>.trycloudflare.com/agent.sh | bash
```

#### Option B: Standalone Python Agent Command
```bash
python3 -m pip install -q websockets psutil && pkill -9 -f agent.py 2>/dev/null; curl -fsSL "https://<your-tunnel-subdomain>.trycloudflare.com/agent.py" -o agent.py && nohup python3 agent.py --wss "wss://<your-tunnel-subdomain>.trycloudflare.com/ws/agent" --token "habib-molab-secure-token-2026" > agent.log 2>&1 & sleep 1.5 && pgrep -f agent.py && echo "[OK] MoLab Agent Online"
```

> **Tip**: You can get your personalized one-liner command copied straight to your clipboard at any time by running `molab connect` in your terminal or clicking **"Copy One-Click Command"** on the Web Dashboard!

---

## 💻 Global CLI Commands

MoLab includes a command-line interface accessible as either `molab` or `cloudpc`:

| Command | Description |
| :--- | :--- |
| `molab start` | Starts the backend control plane and launches the Cloudflare tunnel |
| `molab connect` | Displays and copies the remote pod connection command to your clipboard |
| `molab status` | Displays live server status, tunnel URLs, latency, and agent connection |
| `molab open` | Opens the Web Dashboard directly in your default browser |
| `molab molab` | Displays the A-to-Z autonomous pod execution command |
| `molab stop` | Stops the running control plane server and tunnel processes |
| `molab restart`| Restarts both backend and tunnel services |
| `molab setup` | Checks environment, installs missing dependencies, and prepares binaries |

---

## 🔒 Security & Privacy

* **Zero Cloud Storage**: All telemetry, files, processes, and terminal streams are handled directly between your machine and your remote compute instance. No middleman database or third-party telemetry service ever retains your code or outputs.
* **Token-Based Handshakes**: Remote agents authenticate via cryptographically verified bearer tokens (`AGENT_AUTH_TOKEN`) before any terminal or filesystem commands are authorized.
* **Hardened File Guards**: Traversal protections prevent access beyond authorized directory boundaries, and deletion guards prevent destructive operations against system root directories (`/`, `/etc`, `C:\Windows`).
* **Audit Trail**: Administrative actions (terminal launches, file deletions, process terminations) are logged to a local SQLite database (`data/audit.db`) for compliance and review.

---

## 🧪 Testing

MoLab features an automated test suite verifying authentication, path validation, process controls, terminal bridges, and audit logging.

Run all tests:
```bash
pytest tests/ -v
```

Run the end-to-end roundtrip verification:
```bash
python test_e2e_roundtrip.py
```

---

## 🤝 Contributing

Contributions are warmly welcomed! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, testing requirements, and the pull request submission process.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by **[The-habib](https://github.com/The-habib)**.
