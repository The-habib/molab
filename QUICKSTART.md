# ⚡ Cloud PC Control Plane: Global Autonomous CLI Guide

The **Cloud PC Control Plane** is installed as a system-wide CLI command (`cloudpc` / `molab`) in your Windows environment.

You do **not** need to navigate to folders or rely on shortcuts. Open **any** PowerShell, Command Prompt, or Windows Terminal window from anywhere and manage your pod.

---

## 🚀 10-Second Quickstart

### Step 1: In Any Windows Terminal
Type:
```cmd
cloudpc
```
*(or `cloudpc start`)*

It automatically:
1. Starts the Control Plane backend daemon on `http://127.0.0.1:8800`.
2. Starts the secure Cloudflare tunnel.
3. Opens the dashboard in your default browser.
4. **Automatically copies the 1-line MoLab terminal command directly to your Windows clipboard!**

---

### Step 2: In Your MoLab Linux Terminal
Go to your MoLab browser tab, open the **Linux terminal**, and press:
```bash
Ctrl+V  (or Right-Click -> Paste)
```
Press <kbd>Enter</kbd>.

The command being executed is:
```bash
curl -fsSL https://<ACTIVE-TUNNEL-URL>/agent.sh | bash
```

Within **3 seconds**, your dashboard lights up with your live **NVIDIA RTX PRO 6000 Blackwell Server Edition** (94.97 GB VRAM, 160 GB RAM, 20 vCPUs).

---

## 🛠️ CLI Reference

| Command | Action |
|---------|--------|
| `cloudpc` | Starts the daemon if stopped; shows live status & copies MoLab command. |
| `cloudpc status` | Displays daemon health, tunnel URL, pod connection status, and credentials. |
| `cloudpc molab` | Outputs the MoLab terminal command and auto-copies it to your clipboard. |
| `cloudpc open` | Opens the web dashboard at `http://127.0.0.1:8800` in your default browser. |
| `cloudpc stop` | Gracefully shuts down the background daemon and tunnel. |
| `cloudpc restart` | Restarts the background daemon and tunnel. |
| `cloudpc setup` | Self-heals the Python environment, dependencies, and PATH wrappers. |

---

## 🔑 Default Credentials
- **URL**: [http://127.0.0.1:8800](http://127.0.0.1:8800)
- **Username**: `admin`
- **Password**: `Habib0000`
