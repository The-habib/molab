import os
import re
import sys
import time
import json
import shutil
import logging
import platform
import threading
import subprocess
import urllib.request
from pathlib import Path
from typing import Optional, Dict

BASE_DIR = Path(__file__).resolve().parent.parent
logger = logging.getLogger("tunnel_manager")

class CloudflareTunnelManager:
    def __init__(self, target_port: int = 8800, runtime_file: Optional[str] = None):
        self.target_port = target_port
        self.runtime_file = runtime_file or str(BASE_DIR / "tunnel_runtime.json")
        self.process: Optional[subprocess.Popen] = None
        self.public_https_url: Optional[str] = None
        self.agent_wss_url: Optional[str] = None
        self._url_event = threading.Event()

    def _download_cloudflared(self) -> str:
        """Autonomously downloads the official cloudflared binary for the current OS/architecture."""
        bin_dir = BASE_DIR / "bin"
        bin_dir.mkdir(exist_ok=True)
        os_name = sys.platform
        arch = platform.machine().lower()

        is_arm = "arm" in arch or "aarch64" in arch
        binary_name = "cloudflared.exe" if os_name == "win32" else "cloudflared"
        target_path = bin_dir / binary_name

        if target_path.is_file():
            return str(target_path)

        url = ""
        if os_name == "win32":
            url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        elif os_name == "darwin":
            url = f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-{'arm64' if is_arm else 'amd64'}"
        else:  # linux
            url = f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-{'arm64' if is_arm else 'amd64'}"

        logger.info(f"Downloading official cloudflared binary from {url}...")
        try:
            urllib.request.urlretrieve(url, str(target_path))
            if os_name != "win32":
                import stat
                target_path.chmod(target_path.stat().st_mode | stat.S_IEXEC)
            logger.info(f"cloudflared binary downloaded to {target_path}")
            return str(target_path)
        except Exception as e:
            logger.error(f"Failed to auto-download cloudflared: {e}")
            raise FileNotFoundError(f"cloudflared executable not found and auto-download failed: {e}")

    def find_cloudflared(self) -> str:
        candidates = [
            shutil.which("cloudflared") or "",
            shutil.which("cloudflared.exe") or "",
            str(BASE_DIR / "bin" / ("cloudflared.exe" if sys.platform == "win32" else "cloudflared")),
            str(BASE_DIR.parent / "molab-gpu-bridge" / "bin" / "cloudflared.exe"),
            os.path.expanduser(r"~\AppData\Local\Microsoft\WindowsApps\cloudflared.exe"),
            "/usr/local/bin/cloudflared",
            "/usr/bin/cloudflared",
            "/opt/homebrew/bin/cloudflared"
        ]
        for c in candidates:
            if c and os.path.exists(c):
                return c
        return self._download_cloudflared()

    def start_tunnel(self, timeout: float = 30.0) -> Dict[str, str]:
        cloudflared_bin = self.find_cloudflared()
        target_url = f"http://127.0.0.1:{self.target_port}"
        cmd = [cloudflared_bin, "tunnel", "--url", target_url, "--no-autoupdate"]

        logger.info(f"Starting Cloudflare Quick Tunnel pointing to {target_url}...")
        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

        def drain_stderr():
            for line in iter(self.process.stderr.readline, ''):
                if not line:
                    break
                m = re.search(r"https://([a-zA-Z0-9-]+\.trycloudflare\.com)", line)
                if m and not self.public_https_url:
                    self.public_https_url = f"https://{m.group(1)}"
                    self.agent_wss_url = f"wss://{m.group(1)}/ws/agent"
                    self._url_event.set()

        t = threading.Thread(target=drain_stderr, daemon=True)
        t.start()

        if not self._url_event.wait(timeout=timeout):
            self.stop_tunnel()
            raise TimeoutError("Cloudflare Quick Tunnel failed to generate URL within timeout.")

        runtime_data = {
            "status": "online",
            "public_https_url": self.public_https_url,
            "agent_wss_url": self.agent_wss_url,
            "local_url": f"http://127.0.0.1:{self.target_port}",
            "started_at": time.time()
        }

        with open(self.runtime_file, "w", encoding="utf-8") as f:
            json.dump(runtime_data, f, indent=2)

        logger.info(f"Cloudflare Tunnel online! Public URL: {self.public_https_url}")
        logger.info(f"Agent WSS URL: {self.agent_wss_url}")
        return runtime_data

    def stop_tunnel(self):
        if self.process:
            logger.info("Stopping Cloudflare tunnel process...")
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None

        if os.path.exists(self.runtime_file):
            try:
                os.remove(self.runtime_file)
            except Exception:
                pass

tunnel_manager = CloudflareTunnelManager()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", choices=["start", "stop"], default="start")
    args = parser.parse_args()

    if args.action == "start":
        res = tunnel_manager.start_tunnel()
        print(json.dumps(res, indent=2))
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            tunnel_manager.stop_tunnel()
    else:
        tunnel_manager.stop_tunnel()
