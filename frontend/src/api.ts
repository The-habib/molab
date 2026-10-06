const API_BASE = '/api';

export function getStoredToken(): string | null {
  return localStorage.getItem('cloud_pc_token');
}

export function setStoredToken(token: string) {
  localStorage.setItem('cloud_pc_token', token);
}

export function clearStoredToken() {
  localStorage.removeItem('cloud_pc_token');
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) errorMsg = errJson.detail;
    } catch {}
    throw new Error(errorMsg);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export const api = {
  // Auth
  async login(username: string, password: string) {
    const res = await fetchWithAuth(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  async logout() {
    try {
      await fetchWithAuth(`${API_BASE}/auth/logout`, { method: 'POST' });
    } finally {
      clearStoredToken();
    }
  },

  async getMe() {
    return fetchWithAuth(`${API_BASE}/auth/me`);
  },

  // Dashboard & Multi-Pod
  async getDashboardSummary() {
    return fetchWithAuth(`${API_BASE}/dashboard/summary`);
  },

  async selectPod(podId: string) {
    return fetchWithAuth(`${API_BASE}/dashboard/select_pod`, {
      method: 'POST',
      body: JSON.stringify({ pod_id: podId }),
    });
  },

  async getPods() {
    return fetchWithAuth(`${API_BASE}/dashboard/pods`);
  },

  // Terminal
  async createTerminalSession(cols = 100, rows = 30) {
    return fetchWithAuth(`${API_BASE}/terminal/sessions`, {
      method: 'POST',
      body: JSON.stringify({ cols, rows }),
    });
  },

  async listTerminalSessions() {
    return fetchWithAuth(`${API_BASE}/terminal/sessions`);
  },

  async closeTerminalSession(id: string) {
    return fetchWithAuth(`${API_BASE}/terminal/sessions/${id}`, { method: 'DELETE' });
  },

  // Files
  async listFiles(path = '/workspace') {
    return fetchWithAuth(`${API_BASE}/files/list?path=${encodeURIComponent(path)}`);
  },

  async readFile(path: string) {
    return fetchWithAuth(`${API_BASE}/files/read?path=${encodeURIComponent(path)}`);
  },

  async writeFile(path: string, content: string) {
    return fetchWithAuth(`${API_BASE}/files/write`, {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    });
  },

  async mkdir(path: string) {
    return fetchWithAuth(`${API_BASE}/files/mkdir`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  },

  async renameFile(src: string, dst: string) {
    return fetchWithAuth(`${API_BASE}/files/rename`, {
      method: 'POST',
      body: JSON.stringify({ src, dst }),
    });
  },

  async deleteFile(path: string) {
    return fetchWithAuth(`${API_BASE}/files/delete?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
    });
  },

  async uploadFile(path: string, file: File) {
    const formData = new FormData();
    formData.append('path', path);
    formData.append('file', file);
    return fetchWithAuth(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: formData,
    });
  },

  // Processes
  async listProcesses() {
    return fetchWithAuth(`${API_BASE}/processes`);
  },

  async killProcess(pid: number, signal = 15) {
    return fetchWithAuth(`${API_BASE}/processes/${pid}/kill`, {
      method: 'POST',
      body: JSON.stringify({ signal }),
    });
  },

  // Services
  async listServices() {
    return fetchWithAuth(`${API_BASE}/services`);
  },

  async controlService(name: string, action: string) {
    return fetchWithAuth(`${API_BASE}/services/${encodeURIComponent(name)}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  // GPU
  async getGpuTelemetry() {
    return fetchWithAuth(`${API_BASE}/gpu/telemetry`);
  },

  async runGpuBenchmark(matrix_size = 4096, iterations = 10) {
    return fetchWithAuth(`${API_BASE}/gpu/benchmark`, {
      method: 'POST',
      body: JSON.stringify({ matrix_size, iterations }),
    });
  },

  // Storage
  async getStorageDisks() {
    return fetchWithAuth(`${API_BASE}/storage/disks`);
  },

  async analyzeStorage(path = '/workspace') {
    return fetchWithAuth(`${API_BASE}/storage/analyze?path=${encodeURIComponent(path)}`);
  },

  // Network
  async getNetworkInterfaces() {
    return fetchWithAuth(`${API_BASE}/network/interfaces`);
  },

  async runNetworkDiagnostic(tool: string, target: string) {
    return fetchWithAuth(`${API_BASE}/network/diagnose`, {
      method: 'POST',
      body: JSON.stringify({ tool, target }),
    });
  },

  // Jobs
  async listJobs() {
    return fetchWithAuth(`${API_BASE}/jobs`);
  },

  async submitJob(name: string, type: string, payload: any = {}) {
    return fetchWithAuth(`${API_BASE}/jobs`, {
      method: 'POST',
      body: JSON.stringify({ name, type, payload }),
    });
  },

  async cancelJob(id: string) {
    return fetchWithAuth(`${API_BASE}/jobs/${id}/cancel`, { method: 'POST' });
  },

  // Logs
  async getLogSources() {
    return fetchWithAuth(`${API_BASE}/logs/sources`);
  },

  async tailLog(source = 'syslog', lines = 100) {
    return fetchWithAuth(`${API_BASE}/logs/tail?source=${encodeURIComponent(source)}&lines=${lines}`);
  },

  // Containers
  async listContainers() {
    return fetchWithAuth(`${API_BASE}/containers`);
  },

  async controlContainer(id: string, action: string) {
    return fetchWithAuth(`${API_BASE}/containers/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  // System
  async getSystemInfo() {
    return fetchWithAuth(`${API_BASE}/system/info`);
  },

  async executeSystemAction(action: string) {
    return fetchWithAuth(`${API_BASE}/system/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  // Audit
  async getAuditLogs(limit = 100, offset = 0) {
    return fetchWithAuth(`${API_BASE}/audit/logs?limit=${limit}&offset=${offset}`);
  },

  // Power additions
  async purgeGpuCache() {
    return fetchWithAuth(`${API_BASE}/gpu/purge_cache`, { method: 'POST' });
  },

  async getEnvVars() {
    return fetchWithAuth(`${API_BASE}/system/env`);
  },

  async cleanPycache(path = '/marimo') {
    return fetchWithAuth(`${API_BASE}/files/clean_pycache?path=${encodeURIComponent(path)}`, { method: 'POST' });
  },

  // LLM Cluster & Inference
  async getLlmModels() {
    return fetchWithAuth(`${API_BASE}/llm/models`);
  },

  async getLlmCluster() {
    return fetchWithAuth(`${API_BASE}/llm/cluster`);
  },

  async llmGenerate(prompt: string, model = "hermes3:latest", system?: string, podId?: string, temperature = 0.7) {
    return fetchWithAuth(`${API_BASE}/llm/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt, model, system, pod_id: podId, temperature })
    });
  },

  async llmChat(messages: Array<{role: string, content: string}>, model = "hermes3:latest", system?: string, podId?: string, temperature = 0.7) {
    return fetchWithAuth(`${API_BASE}/llm/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages, model, system, pod_id: podId, temperature })
    });
  },
};
