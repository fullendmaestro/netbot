import os
import asyncio
import json
from typing import Dict, Any, List, Optional, Union
from contextlib import asynccontextmanager
import uvicorn 

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from assistant_stream.serialization import DataStreamResponse
from assistant_stream import RunController, create_run

from google.antigravity import Agent, LocalAgentConfig

load_dotenv()

class MessagePart(BaseModel):
    type: str
    text: Optional[str] = None
    image: Optional[str] = None

class UserMessage(BaseModel):
    role: str = "user"
    parts: List[MessagePart]

class AddMessageCommand(BaseModel):
    type: str = "add-message"
    message: UserMessage

class AddToolResultCommand(BaseModel):
    type: str = "add-tool-result"
    toolCallId: str
    result: Dict[str, Any]

class AssistantRequest(BaseModel):
    commands: List[Union[AddMessageCommand, AddToolResultCommand]]
    system: Optional[str] = None
    tools: Optional[Dict[str, Any]] = None
    runConfig: Optional[Dict[str, Any]] = None
    state: Optional[Dict[str, Any]] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title="Antigravity Agent Backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_agent_config():
    project = os.getenv("GCP_PROJECT_ID")
    location = os.getenv("GCP_LOCATION", "us-central1")
    model_name = os.getenv("ANTIGRAVITY_MODEL", "gemini-2.5-flash")
    
    return LocalAgentConfig(
        vertex=True,
        project=project,
        location=location,
        model=model_name
    )

@app.post("/assistant")
async def assistant_endpoint(request: AssistantRequest):
    async def run_callback(controller: RunController):
        try:
            if "messages" not in controller.state:
                controller.state["messages"] = []
                
            for cmd in request.commands:
                if cmd.type == "add-message":
                    controller.state["messages"].append(cmd.message.model_dump())
                elif cmd.type == "add-tool-result":
                    # Basic support for adding tool results
                    pass
            
            user_msg = "Hello"
            if request.commands and request.commands[-1].type == "add-message":
                for part in request.commands[-1].message.parts:
                    if part.type == "text":
                        user_msg = part.text

            config = get_agent_config()
            
            async with Agent(config) as agent:
                controller.state["messages"].append({
                    "role": "assistant",
                    "parts": []
                })
                
                response = await agent.chat(user_msg)
                
                async def process_text():
                    has_text_part = False
                    text_part_index = 0
                    async for chunk in response:
                        if not has_text_part:
                            controller.state["messages"][-1]["parts"].append({
                                "type": "text",
                                "text": ""
                            })
                            text_part_index = len(controller.state["messages"][-1]["parts"]) - 1
                            has_text_part = True
                        controller.state["messages"][-1]["parts"][text_part_index]["text"] += chunk
                        await asyncio.sleep(0)
                        
                async def process_tools():
                    async for tool_call in response.tool_calls:
                        args_text = json.dumps(tool_call.args) if tool_call.args else "{}"
                        tool_call_id = f"{tool_call.name}_{os.urandom(4).hex()}"
                        controller.state["messages"][-1]["parts"].append({
                            "type": "tool-call",
                            "toolCallId": tool_call_id,
                            "toolName": tool_call.name,
                            "argsText": args_text,
                            "done": True,
                        })

                await asyncio.gather(process_text(), process_tools())

            controller.state["provider"] = "completed"

        except Exception as e:
            print(f"Error in stream generation: {e}")
            controller.state["provider"] = "error"
            controller.append_text(f"Error: {str(e)}")

    state = request.state if request.state is not None else {"messages": []}
    stream = create_run(run_callback, state=state)
    return DataStreamResponse(stream)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8010"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

