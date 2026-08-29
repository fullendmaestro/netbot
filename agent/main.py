import os
import asyncio
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google.adk.cli.fast_api import get_fast_api_app
import firebase_admin
from api.hello import router as hello_router
from api.gns3 import router as gns3_router
from api.librenms import router as librenms_router

load_dotenv()

if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': 'netbot-603c0'})

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
app.include_router(gns3_router)
app.include_router(librenms_router)



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))