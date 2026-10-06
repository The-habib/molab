import urllib.request
import json
import time

def deploy_to_all_pods():
    # 1. Login
    req = urllib.request.Request(
        'http://127.0.0.1:8800/api/auth/login',
        data=json.dumps({'username': 'admin', 'password': 'Habib0000'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    token = json.loads(urllib.request.urlopen(req).read())['token']

    # 2. Get pods
    req2 = urllib.request.Request(
        'http://127.0.0.1:8800/api/dashboard/summary',
        headers={'Authorization': f'Bearer {token}'}
    )
    summary = json.loads(urllib.request.urlopen(req2).read())
    pods = summary.get('pods', [])
    print(f"[*] Found {len(pods)} connected pods in cluster.")

    bash_command = (
        "nohup bash -c '"
        "if ! command -v ollama >/dev/null 2>&1; then "
        "echo \"Installing Ollama...\" >> /marimo/setup.log; "
        "curl -fsSL https://ollama.com/install.sh | sh; "
        "fi; "
        "if ! pgrep -f \"ollama serve\" >/dev/null 2>&1; then "
        "echo \"Starting Ollama...\" >> /marimo/setup.log; "
        "OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve > /marimo/ollama.log 2>&1 & "
        "sleep 3; "
        "fi; "
        "echo \"Pulling Hermes 3 into Blackwell VRAM...\" >> /marimo/setup.log; "
        "nohup ollama pull hermes3:latest > /marimo/pull.log 2>&1 & "
        "echo \"Setup launched.\" >> /marimo/setup.log"
        "' > /dev/null 2>&1 & \n"
    )

    for p in pods:
        pid = p['pod_id']
        # Select pod
        req_sel = urllib.request.Request(
            'http://127.0.0.1:8800/api/dashboard/select_pod',
            data=json.dumps({'pod_id': pid}).encode(),
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
        )
        urllib.request.urlopen(req_sel)

        # Create session
        req_sess = urllib.request.Request(
            'http://127.0.0.1:8800/api/terminal/sessions',
            data=json.dumps({'cols': 100, 'rows': 30}).encode(),
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
        )
        sid = json.loads(urllib.request.urlopen(req_sess).read())['session_id']

        # Dispatch command
        req_in = urllib.request.Request(
            f'http://127.0.0.1:8800/api/terminal/sessions/{sid}/input',
            data=json.dumps({'input': bash_command}).encode(),
            headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
        )
        urllib.request.urlopen(req_in)
        print(f"  [OK] Autonomous LLM deployment triggered on pod {pid}")
        time.sleep(1)

    print("\n[SUCCESS] Autonomous deployment dispatched to all 4 Blackwell GPU nodes!")

if __name__ == "__main__":
    deploy_to_all_pods()
