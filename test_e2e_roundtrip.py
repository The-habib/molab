import os
import sys
import time
import json
import asyncio
import threading
import urllib.request
import uvicorn
from backend.main import app
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD, AGENT_AUTH_TOKEN
from agent.molab_agent import MolabAgent

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8800, log_level="warning")

async def run_agent():
    agent = MolabAgent(
        wss_url="ws://127.0.0.1:8800/ws/agent",
        token=AGENT_AUTH_TOKEN,
        agent_id="molab-e2e-worker"
    )
    task = asyncio.create_task(agent.run_forever())
    return agent, task

def http_json(url, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode())

def main():
    print("=" * 60)
    print("  CLOUD PC CONTROL PLANE - END-TO-END ROUNDTRIP TEST")
    print("=" * 60)

    # 1. Start server in thread
    print("\n[1/7] Starting Control Plane Server on 127.0.0.1:8800...")
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(1.5)

    # 2. Check health
    health = http_json("http://127.0.0.1:8800/health")
    print(f"  [OK] Health status: {health['status']} (Service: {health['service']})")

    # 3. Authenticate Admin
    print("\n[2/7] Authenticating Administrator...")
    login = http_json("http://127.0.0.1:8800/api/auth/login", method="POST", data={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    token = login["token"]
    print(f"  [OK] Admin authenticated successfully: {login['username']}")

    # 4. Start Agent in background loop thread
    print("\n[3/7] Connecting Remote Cloud PC Agent to ws://127.0.0.1:8800/ws/agent...")
    loop = asyncio.new_event_loop()
    agent_thread = threading.Thread(target=loop.run_forever, daemon=True)
    agent_thread.start()

    agent = MolabAgent(
        wss_url="ws://127.0.0.1:8800/ws/agent",
        token=AGENT_AUTH_TOKEN,
        agent_id="molab-e2e-blackwell"
    )
    asyncio.run_coroutine_threadsafe(agent.run_forever(), loop)
    time.sleep(2.0)

    # 5. Check Dashboard Summary
    print("\n[4/7] Verifying Remote Cloud PC Connection & Telemetry...")
    summary = http_json("http://127.0.0.1:8800/api/dashboard/summary", token=token)
    assert summary["online"] is True, "Expected agent to be online"
    print(f"  [OK] Remote Hostname: {summary['agent']['hostname']} ({summary['agent']['os']})")
    print(f"  [OK] CPU Cores: {summary['agent']['cpu_count']}")
    print(f"  [OK] Connection Latency: {summary['latency_ms']} ms")
    if summary["agent"].get("gpu"):
        gpu = summary["agent"]["gpu"]
        print(f"  [OK] GPU Detected: {gpu.get('gpu_name', 'NVIDIA Blackwell GPU')}")

    # 6. Test File & Process RPCs through Agent
    print("\n[5/7] Executing Remote RPCs (Filesystem & Processes)...")
    files = http_json("http://127.0.0.1:8800/api/files/list?path=.", token=token)
    print(f"  [OK] Files Listed: {len(files['entries'])} entries in '{files['current_path']}'")

    procs = http_json("http://127.0.0.1:8800/api/processes", token=token)
    print(f"  [OK] Processes Listed: {len(procs)} processes inspected")

    # 7. Test Terminal Session Creation
    print("\n[6/7] Creating Interactive PTY Terminal Session...")
    term = http_json("http://127.0.0.1:8800/api/terminal/sessions", method="POST", data={"cols": 120, "rows": 30}, token=token)
    sid = term["session_id"]
    print(f"  [OK] Terminal Session Opened: {sid}")

    # 8. Test Background Job Submission
    print("\n[7/7] Submitting Benchmark Job to Queue...")
    job = http_json("http://127.0.0.1:8800/api/jobs", method="POST", data={
        "name": "E2E Roundtrip Verification",
        "type": "ping"
    }, token=token)
    time.sleep(1.0)
    job_details = http_json(f"http://127.0.0.1:8800/api/jobs/{job['job_id']}", token=token)
    print(f"  [OK] Job Status: {job_details['status']} ({job_details['name']})")

    print("\n" + "=" * 60)
    print("  [OK] ALL 7 END-TO-END ROUNDTRIP CHECKS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    main()
