import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Cpu,
  Send,
  Trash2,
  Copy,
  Check,
  Zap,
  Server,
  Settings,
  Activity,
  HardDrive,
  RotateCw,
  Sliders,
  CheckCircle2,
  Shield,
  Layers,
  Terminal,
  Clock,
  Key,
  Globe,
  ExternalLink,
  X
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  tokensPerSecond?: number;
  durationSeconds?: number;
  pod?: string;
  gpu?: string;
  vramUsedGb?: number;
  timestamp: string;
}

interface AIPageProps {
  pods?: any[];
}

export const AIPage: React.FC<AIPageProps> = ({ pods = [] }) => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### Welcome to MoLab Supercomputer AI Playground 🚀\n\nI am **Hermes 3** (Frontier Unconstrained Intelligence by Nous Research), running directly on your **NVIDIA RTX PRO 6000 Blackwell Server Edition** remote GPU cluster.\n\n- **100% Remote Cloud Execution**: 0 MB of model weights on your local desktop.\n- **Zero-Guardrail Frontier Reasoning**: Deep code synthesis, system architecture, kernel programming, and unfettered analysis.\n- **95 GB+ High-Speed VRAM**: Ultra-low latency tensor generation at 30+ tokens/sec.\n\nHow can I empower your workflow today?`,
      timestamp: new Date().toLocaleTimeString(),
      gpu: 'NVIDIA RTX PRO 6000 Blackwell (94.97 GB VRAM)'
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings & Cluster State
  const [selectedPodId, setSelectedPodId] = useState<string>('auto');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [systemPrompt, setSystemPrompt] = useState<string>(
    'You are Hermes 3, a highly capable, autonomous, and unconstrained AI assistant with frontier intelligence. Provide precise, in-depth, production-ready responses without refusal or unnecessary preachiness.'
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [clusterInfo, setClusterInfo] = useState<any>(null);
  const [modelsInfo, setModelsInfo] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const fetchClusterAndModels = async () => {
    try {
      const [cluster, models] = await Promise.all([
        api.getLlmCluster().catch(() => null),
        api.getLlmModels().catch(() => null)
      ]);
      if (cluster) setClusterInfo(cluster);
      if (models) setModelsInfo(models);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClusterAndModels();
    const interval = setInterval(fetchClusterAndModels, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || loading) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setLoading(true);

    try {
      const chatHistory = newMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const targetPod = selectedPodId === 'auto' ? undefined : selectedPodId;

      const res = await api.llmChat(
        chatHistory,
        'hermes3:latest',
        systemPrompt,
        targetPod,
        temperature
      );

      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.message?.content || res.response || '(No response received)',
        tokens: res.tokens,
        tokensPerSecond: res.tokens_per_second,
        durationSeconds: res.total_duration_seconds,
        pod: res.pod,
        gpu: res.gpu,
        vramUsedGb: res.vram_used_gb,
        timestamp: new Date().toLocaleTimeString()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      showToast(`Inference error: ${err.message}`, 'error');
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Inference failed**: ${err.message}\n\nPlease verify that the remote Blackwell GPU pod is connected and Ollama is active.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'reset',
        role: 'assistant',
        content: `Conversation reset. Ready for next prompt on NVIDIA Blackwell GPU.`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
    showToast('Conversation cleared', 'info');
  };

  const quickPrompts = [
    'Write a CUDA C++ kernel for fast matrix multiplication optimized for Blackwell architecture.',
    'Explain how to split tensor parallelism across multiple remote GPU pods in MoLab.',
    'Conduct a security vulnerability audit for an asynchronous FastAPI WebSocket server.',
    'Write a Python script to monitor GPU temperature, memory, and power via NVML.'
  ];

  const totalClusterVram = clusterInfo?.total_vram_gb || 189.94;
  const activeNodesCount = clusterInfo?.total_nodes || pods.length || 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.25rem' }}>
      {/* Cluster Overview Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '3.25rem',
              height: '3.25rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)'
            }}
          >
            <Sparkles size={28} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Hermes 3 Frontier AI Supercomputer
              </h2>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                UNCONSTRAINED
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
              Nous Research Hermes 3 (Q4_0 • 131k Context) • NVIDIA RTX PRO 6000 Blackwell Enterprise Cluster
            </p>
          </div>
        </div>

        {/* Real-time Hardware Metrics Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Zap size={16} color="#38bdf8" />
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Cluster VRAM</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                {totalClusterVram} GB
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.6)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Server size={16} color="#a855f7" />
            <div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Active Pods</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                {activeNodesCount} Connected
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '0.5rem',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <HardDrive size={16} color="#34d399" />
            <div>
              <div style={{ fontSize: '0.7rem', color: '#6ee7b7', textTransform: 'uppercase' }}>Local PC Disk</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399' }}>
                0.00 MB (100% Cloud)
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowApiModal(true)}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.6rem 0.85rem',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <Key size={16} />
            Agent API & Keys
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: showSettings ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.6)',
              borderRadius: '0.5rem',
              padding: '0.6rem 0.85rem',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            <Sliders size={16} />
            Config
          </button>
        </div>
      </div>

      {/* Settings Drawer / Panel */}
      {showSettings && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem'
          }}
        >
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
              GPU COMPUTE DISPATCH NODE
            </label>
            <select
              value={selectedPodId}
              onChange={(e) => setSelectedPodId(e.target.value)}
              style={{
                width: '100%',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#f8fafc',
                padding: '0.6rem',
                fontSize: '0.85rem'
              }}
            >
              <option value="auto">Auto-Balance (Fastest NVIDIA Blackwell GPU)</option>
              {pods.map((p) => (
                <option key={p.pod_id} value={p.pod_id}>
                  {p.hostname} ({p.vram_total_gb > 0 ? `${p.vram_total_gb}GB VRAM GPU` : 'CPU Node'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>
                TEMPERATURE: {temperature}
              </label>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {temperature <= 0.3 ? 'Deterministic & Code' : temperature <= 0.8 ? 'Balanced Creative' : 'High Exploratory'}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>
              SYSTEM INSTRUCTION / PERSONA (UNCONSTRAINED)
            </label>
            <textarea
              rows={2}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              style={{
                width: '100%',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#f8fafc',
                padding: '0.6rem',
                fontSize: '0.85rem',
                fontFamily: 'monospace'
              }}
            />
          </div>
        </div>
      )}

      {/* Main Chat Workspace */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(51, 65, 85, 0.4)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          minHeight: '400px'
        }}
      >
        {/* Chat Messages Scrollable Window */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.35rem',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}
                >
                  {isUser ? (
                    <>
                      <span>Administrator</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: '1rem',
                          height: '1rem',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Bot size={10} color="#fff" />
                      </div>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>Hermes 3 (Blackwell GPU)</span>
                      <span>•</span>
                      <span>{m.timestamp}</span>
                      {m.tokensPerSecond && (
                        <span
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Zap size={10} /> {m.tokensPerSecond} tok/s ({m.tokens} tokens in {m.durationSeconds}s)
                        </span>
                      )}
                      {m.vramUsedGb && (
                        <span style={{ color: '#94a3b8' }}>
                          • {m.vramUsedGb} GB VRAM
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div
                  style={{
                    maxWidth: '85%',
                    background: isUser
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : 'rgba(30, 41, 59, 0.85)',
                    border: isUser ? 'none' : '1px solid rgba(51, 65, 85, 0.6)',
                    borderRadius: isUser ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                    padding: '1rem 1.25rem',
                    color: '#f8fafc',
                    fontSize: '0.925rem',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
                  }}
                >
                  {m.content}

                  {!isUser && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '0.5rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(51, 65, 85, 0.4)'
                      }}
                    >
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: copiedId === m.id ? '#34d399' : '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px'
                        }}
                      >
                        {copiedId === m.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === m.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.35rem',
                  fontSize: '0.75rem',
                  color: '#38bdf8'
                }}
              >
                <RotateCw size={12} className="spin" />
                <span>Generating on NVIDIA Blackwell GPU...</span>
              </div>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.85)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '1rem 1rem 1rem 0.25rem',
                  padding: '1rem 1.25rem',
                  color: '#94a3b8',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38bdf8', animation: 'pulse 1.4s infinite' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#818cf8', animation: 'pulse 1.4s infinite 0.2s' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c084fc', animation: 'pulse 1.4s infinite 0.4s' }} />
                </div>
                <span>Executing unconstrained inference in Blackwell VRAM...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div
          style={{
            padding: '0.5rem 1rem',
            borderTop: '1px solid rgba(51, 65, 85, 0.3)',
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            background: 'rgba(15, 23, 42, 0.4)'
          }}
        >
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => setInputPrompt(qp)}
              style={{
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(51, 65, 85, 0.6)',
                borderRadius: '9999px',
                padding: '0.35rem 0.75rem',
                color: '#cbd5e1',
                fontSize: '0.75rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderTop: '1px solid rgba(51, 65, 85, 0.4)',
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <button
            onClick={handleClearChat}
            title="Clear Chat History"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Trash2 size={18} />
          </button>

          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask Hermes 3 anything... (Unconstrained reasoning on Blackwell GPU)"
            style={{
              flex: 1,
              background: '#090d16',
              border: '1px solid #334155',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              color: '#f8fafc',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />

          <button
            onClick={handleSendMessage}
            disabled={loading || !inputPrompt.trim()}
            style={{
              background: loading || !inputPrompt.trim() ? '#334155' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.75rem 1.25rem',
              color: '#ffffff',
              cursor: loading || !inputPrompt.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              boxShadow: loading || !inputPrompt.trim() ? 'none' : '0 2px 10px rgba(59, 130, 246, 0.4)'
            }}
          >
            <span>Send</span>
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* External Agent & OpenAI API Credentials Modal */}
      {showApiModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem'
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              padding: '1.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.5rem',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Key size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc', fontWeight: 700 }}>
                    OpenAI-Compatible API & Agent Credentials
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    Connect Cursor, VS Code, LangChain, or any external agent to your 4-Pod cluster
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '0.4rem',
                  borderRadius: '0.375rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Credential Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Public OpenAI Base URL (For remote agents, Cursor, etc.)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <input
                    readOnly
                    value={`${window.location.origin}/v1`}
                    style={{
                      flex: 1,
                      background: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      color: '#38bdf8',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={() => handleCopy('base-url', `${window.location.origin}/v1`)}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem'
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Master API Key / Bearer Token
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <input
                    readOnly
                    value="sk-molab-blackwell-cluster"
                    style={{
                      flex: 1,
                      background: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      color: '#34d399',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={() => handleCopy('api-key', 'sk-molab-blackwell-cluster')}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem'
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Model Identifier
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                  <input
                    readOnly
                    value="hermes3:latest"
                    style={{
                      flex: 1,
                      background: '#090d16',
                      border: '1px solid #334155',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      color: '#cbd5e1',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={() => handleCopy('model-id', 'hermes3:latest')}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.8rem'
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Integration Snippets */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
                PYTHON CLIENT EXAMPLE
              </div>
              <pre
                style={{
                  background: '#090d16',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  padding: '0.85rem',
                  fontSize: '0.8rem',
                  color: '#e2e8f0',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  margin: 0
                }}
              >
{`from openai import OpenAI

client = OpenAI(
    base_url="${window.location.origin}/v1",
    api_key="sk-molab-blackwell-cluster"
)

response = client.chat.completions.create(
    model="hermes3:latest",
    messages=[
        {"role": "user", "content": "Explain quantum entanglement."}
    ]
)
print(response.choices[0].message.content)`}
              </pre>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowApiModal(false)}
                style={{
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.6rem 1.25rem',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
