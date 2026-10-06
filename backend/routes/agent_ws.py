import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from backend.auth import verify_agent_token
from backend.agent_manager import agent_manager

logger = logging.getLogger("agent_ws")
router = APIRouter(tags=["agent_ws"])

@router.websocket("/ws/agent")
async def agent_websocket_endpoint(websocket: WebSocket):
    # Extract token from header or query param
    auth_header = websocket.headers.get("authorization", "")
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = websocket.query_params.get("token", "")

    if not verify_agent_token(token):
        logger.warning("Rejected unauthenticated agent connection attempt.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Unauthorized")
        return

    await websocket.accept()
    logger.info("Accepted authenticated agent WebSocket connection.")

    try:
        # Await first registration message
        first_msg = await websocket.receive_text()
        import json
        reg_data = json.loads(first_msg)
        ack = await agent_manager.register_agent(websocket, reg_data)
        await websocket.send_text(json.dumps(ack))

        # Main receive loop
        while True:
            data = await websocket.receive_text()
            await agent_manager.handle_agent_message(data)

    except WebSocketDisconnect:
        logger.info("Agent disconnected.")
    except Exception as e:
        logger.error(f"Error in agent WebSocket loop: {e}")
    finally:
        agent_manager.disconnect_agent()
