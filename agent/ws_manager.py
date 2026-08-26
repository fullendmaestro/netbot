import asyncio
import json
import uuid
from typing import Dict, Optional
from fastapi import WebSocket

class AgentBridgeManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.client_projects: Dict[str, str] = {}
        self.pending_rpcs: Dict[str, asyncio.Future] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def get_loop(self) -> asyncio.AbstractEventLoop:
        if self.loop and self.loop.is_running():
            return self.loop
        try:
            loop = asyncio.get_running_loop()
            self.loop = loop
            return loop
        except RuntimeError:
            if self.loop:
                return self.loop
            raise RuntimeError("FastAPI asyncio event loop has not been captured yet. Ensure Electron WebSocket is connected.")

    async def connect(self, client_id: str, websocket: WebSocket, project_id: str = None):
        await websocket.accept()
        self.loop = asyncio.get_running_loop()
        self.active_connections[client_id] = websocket
        if project_id:
            self.client_projects[client_id] = project_id
        print(f"[WS Bridge] Client connected: {client_id}, Project: {project_id}")

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)
        self.client_projects.pop(client_id, None)
        print(f"[WS Bridge] Client disconnected: {client_id}")

    def get_project_id(self, client_id: str) -> str | None:
        return self.client_projects.get(client_id)

    def handle_message(self, client_id: str, data: dict):
        if data.get("type") == "rpc_response":
            rpc_id = data.get("rpcId")
            future = self.pending_rpcs.pop(rpc_id, None)
            if future and not future.done():
                if data.get("success", False):
                    future.set_result(data.get("output", ""))
                else:
                    future.set_exception(RuntimeError(data.get("error", "Unknown execution error")))

    async def execute_remote_command(self, client_id: str, device_identifier: str, command: str, timeout: float = 20.0) -> str:
        websocket = self.active_connections.get(client_id)
        if not websocket:
            raise RuntimeError(f"No active desktop app connected for user: {client_id}")

        loop = self.get_loop()
        rpc_id = str(uuid.uuid4())
        future = loop.create_future()
        self.pending_rpcs[rpc_id] = future

        payload = {
            "type": "rpc_request",
            "rpcId": rpc_id,
            "action": "execute_command",
            "params": {
                "deviceIdentifier": device_identifier,
                "command": command,
                "timeoutMs": 8000
            }
        }

        await websocket.send_text(json.dumps(payload))
        return await asyncio.wait_for(future, timeout=timeout)

bridge_manager = AgentBridgeManager()