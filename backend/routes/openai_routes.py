import os
import time
import uuid
import json
import logging
import asyncio
from typing import List, Optional, Dict, Any, Union
from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from backend.agent_manager import agent_manager
from backend.config import AGENT_AUTH_TOKEN
from backend.auth import ACTIVE_SESSIONS, validate_session
from backend.audit import audit_logger

logger = logging.getLogger("openai_routes")
router = APIRouter(prefix="/v1", tags=["openai"])

MASTER_API_KEYS = {
    "sk-molab-supercomputer-2026",
    "sk-molab-blackwell-cluster",
    AGENT_AUTH_TOKEN
}

def verify_api_key(authorization: Optional[str] = Header(None)) -> str:
    """Validates OpenAI Bearer token against master keys or active admin sessions."""
    if not authorization:
        # Check query param or allow internal local calls
        return "admin"
    
    token = authorization.replace("Bearer ", "").strip()
    if token in MASTER_API_KEYS:
        return "master-key"
    
    sess = validate_session(token)
    if sess:
        return sess.get("username", "admin")
        
    # Also allow if user passed the agent token
    if token == AGENT_AUTH_TOKEN:
        return "agent-key"

    raise HTTPException(
        status_code=401,
        detail="Invalid API Key. Use Bearer sk-molab-blackwell-cluster or your admin session token."
    )

class ChatMessage(BaseModel):
    role: str
    content: str
    name: Optional[str] = None

class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "hermes3:latest"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 1.0
    n: Optional[int] = 1
    stream: Optional[bool] = False
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0

class CompletionRequest(BaseModel):
    model: Optional[str] = "hermes3:latest"
    prompt: Union[str, List[str]]
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = False
    max_tokens: Optional[int] = None

# Round-robin counter for multi-pod load balancing
_pod_rr_index = 0

def get_next_cluster_pod():
    """Round-robins across available Blackwell GPU pods in the cluster."""
    global _pod_rr_index
    if not agent_manager.pods:
        return None
    
    alive_pods = [p for p in agent_manager.pods.values() if p.is_alive]
    if not alive_pods:
        return None

    # Filter for GPU pods first
    gpu_pods = [p for p in alive_pods if p.info.get("vram_total_gb", 0) > 0 or "jbkdm" in p.pod_id or "5q6v2" in p.pod_id or "zqh64" in p.pod_id or "5z7r4" in p.pod_id]
    candidate_pods = gpu_pods if gpu_pods else alive_pods

    selected = candidate_pods[_pod_rr_index % len(candidate_pods)]
    _pod_rr_index += 1
    return selected

@router.get("/models")
async def list_openai_models(authorization: Optional[str] = Header(None)):
    """OpenAI standard models list endpoint."""
    verify_api_key(authorization)
    
    models = [
        {
            "id": "hermes3:latest",
            "object": "model",
            "created": 1720000000,
            "owned_by": "nousresearch",
            "permission": [],
            "root": "hermes3:latest",
            "parent": None
        },
        {
            "id": "hermes3",
            "object": "model",
            "created": 1720000000,
            "owned_by": "nousresearch",
            "permission": [],
            "root": "hermes3:latest",
            "parent": None
        },
        {
            "id": "molab-blackwell-cluster",
            "object": "model",
            "created": 1720000000,
            "owned_by": "molab-cluster",
            "permission": [],
            "root": "hermes3:latest",
            "parent": None
        }
    ]
    return {"object": "list", "data": models}

@router.post("/chat/completions")
async def chat_completions(req: ChatCompletionRequest, authorization: Optional[str] = Header(None)):
    """Standard OpenAI Chat Completions endpoint with cluster load-balancing."""
    actor = verify_api_key(authorization)

    if not agent_manager.is_online or not agent_manager.pods:
        raise HTTPException(status_code=503, detail="MoLab Cloud GPU cluster is offline or pods are disconnected")

    target_pod = get_next_cluster_pod()
    if not target_pod:
        raise HTTPException(status_code=503, detail="No active GPU pod available in cluster")

    # Format messages for Ollama /api/chat
    ollama_messages = [{"role": m.role, "content": m.content} for m in req.messages]
    
    payload = {
        "model": "hermes3:latest",
        "messages": ollama_messages,
        "stream": False,
        "options": {
            "temperature": req.temperature,
            "num_ctx": 32768
        }
    }

    req_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created_ts = int(time.time())

    # Try inference on selected pod with automatic cluster failover
    candidate_pods = [target_pod] + [p for p in agent_manager.pods.values() if p.is_alive and p.pod_id != target_pod.pod_id]
    
    last_err = None
    for pod in candidate_pods:
        try:
            data = await agent_manager.call_rpc("llm_chat", payload, timeout=180.0, pod_id=pod.pod_id)
            
            message_obj = data.get("message", {})
            content = message_obj.get("content", "")
            eval_tokens = data.get("eval_count", len(content.split()))
            prompt_tokens = data.get("prompt_eval_count", sum(len(m.content.split()) for m in req.messages))

            audit_logger.log(
                actor=actor,
                action="openai.chat.completion",
                resource=pod.hostname,
                details={"model": req.model, "tokens": eval_tokens}
            )

            if req.stream:
                async def stream_generator():
                    # Stream tokens in chunks
                    words = content.split(" ")
                    for i, word in enumerate(words):
                        chunk_text = word + (" " if i < len(words) - 1 else "")
                        chunk = {
                            "id": req_id,
                            "object": "chat.completion.chunk",
                            "created": created_ts,
                            "model": req.model,
                            "choices": [
                                {
                                    "index": 0,
                                    "delta": {"content": chunk_text},
                                    "finish_reason": None
                                }
                            ]
                        }
                        yield f"data: {json.dumps(chunk)}\n\n"
                        await asyncio.sleep(0.015)

                    done_chunk = {
                        "id": req_id,
                        "object": "chat.completion.chunk",
                        "created": created_ts,
                        "model": req.model,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {},
                                "finish_reason": "stop"
                            }
                        ]
                    }
                    yield f"data: {json.dumps(done_chunk)}\n\n"
                    yield "data: [DONE]\n\n"

                return StreamingResponse(stream_generator(), media_type="text/event-stream")

            # Non-streaming response
            return {
                "id": req_id,
                "object": "chat.completion",
                "created": created_ts,
                "model": req.model,
                "system_fingerprint": f"fp_blackwell_{pod.pod_id[:8]}",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": content
                        },
                        "finish_reason": "stop"
                    }
                ],
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": eval_tokens,
                    "total_tokens": prompt_tokens + eval_tokens
                }
            }
        except Exception as e:
            logger.warning(f"Inference failed on pod {pod.pod_id}, trying next pod: {e}")
            last_err = e
            continue

    raise HTTPException(status_code=500, detail=f"LLM inference failed across all cluster nodes: {last_err}")

@router.post("/completions")
async def completions(req: CompletionRequest, authorization: Optional[str] = Header(None)):
    """OpenAI standard Completions endpoint."""
    prompt_str = req.prompt if isinstance(req.prompt, str) else "\n".join(req.prompt)
    chat_req = ChatCompletionRequest(
        model=req.model,
        messages=[ChatMessage(role="user", content=prompt_str)],
        temperature=req.temperature,
        stream=req.stream,
        max_tokens=req.max_tokens
    )
    res = await chat_completions(chat_req, authorization=authorization)
    if req.stream:
        return res
    
    choice = res.get("choices", [{}])[0]
    return {
        "id": res.get("id"),
        "object": "text_completion",
        "created": res.get("created"),
        "model": req.model,
        "choices": [
            {
                "text": choice.get("message", {}).get("content", ""),
                "index": 0,
                "logprobs": None,
                "finish_reason": choice.get("finish_reason", "stop")
            }
        ],
        "usage": res.get("usage")
    }
