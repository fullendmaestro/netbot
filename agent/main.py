import os
import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google.adk.cli.fast_api import get_fast_api_app
from ws_manager import bridge_manager
from api.hello import router as hello_router

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))
SESSION_SERVICE_URI = "sqlite+aiosqlite:///./sessions.db"
ALLOWED_ORIGINS = ["*"]
SERVE_WEB_INTERFACE = True

app: FastAPI = get_fast_api_app(
    agents_dir=AGENT_DIR,
    session_service_uri=SESSION_SERVICE_URI,
    allow_origins=ALLOWED_ORIGINS,
    web=SERVE_WEB_INTERFACE,
)

# Mount the HTTP APIs again
app.include_router(hello_router)

@app.on_event("startup")
async def startup_event():
    bridge_manager.set_loop(asyncio.get_running_loop())

@app.websocket("/ws/bridge/{client_id}")
async def websocket_bridge_endpoint(websocket: WebSocket, client_id: str, token: str, project_id: str = None):
    from api.auth import verify_ws_token
    try:
        verify_ws_token(token)
    except Exception as e:
        await websocket.close(code=1008, reason=str(e))
        return
    await bridge_manager.connect(client_id, websocket, project_id)
    try:
        while True:
            data = await websocket.receive_json()
            bridge_manager.handle_message(client_id, data)
    except WebSocketDisconnect:
        bridge_manager.disconnect(client_id)
    except Exception as e:
        print(f"[WS Bridge] Error: {e}")
        bridge_manager.disconnect(client_id)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))