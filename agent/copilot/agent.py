import json
import asyncio
import firebase_admin
from firebase_admin import firestore
from google.adk.agents.llm_agent import Agent
from google.adk.tools.tool_context import ToolContext as Context
from copilot.firebase_dispatcher import execute_remote_command

def _get_devices_from_db(project_id: str) -> list:
    """Read devices directly from Firestore based on the active project."""
    if not project_id:
        return []
    
    db = firestore.client()
    docs = db.collection('projects').document(project_id).collection('devices').stream()
    
    devices = []
    for doc in docs:
        d = doc.to_dict()
        d['id'] = doc.id
        d['connectionStatus'] = 'Offline'
        devices.append(d)
        
    return devices

def list_managed_devices(ctx: Context) -> str:
    """
    Returns the list of all registered network devices (SSH and Serial), 
    their IDs, connection types, and active statuses.
    """
    try:
        project_id = ctx.state.get('project_id')
        if not project_id:
            return "Error: No active project found in context state."
            
        devices = _get_devices_from_db(project_id)
        return json.dumps(devices, indent=2)
    except Exception as e:
        return f"Error fetching devices: {str(e)}"

async def run_terminal_command(ctx: Context, device_identifier: str, command: str) -> str:
    """
    Executes a shell or terminal command on a specific managed device (by Name or Device ID)
    and returns the terminal output.
    """
    try:
        project_id = ctx.state.get('project_id')
        if not project_id:
            return "Error: No active project found in context state."
            
        return await execute_remote_command(
            project_id=project_id,
            device_identifier=device_identifier,
            command=command,
            timeout=20.0
        )
    except asyncio.TimeoutError:
        return "Error: Command execution timed out. The device took too long to respond."
    except Exception as e:
        err = str(e) or repr(e)
        return f"Error executing command via bridge: {err}"


root_agent = Agent(
    model='gemini-2.5-flash',
    name='root_agent',
    description='A network engineering assistant capable of inspecting and interacting with connected devices.',
    instruction=(
        'You are Netbot, an intelligent network and system copilot. '
        'You have tools to list devices (`list_managed_devices`) and execute terminal commands '
        '(`run_terminal_command`) on SSH and Serial connected devices. '
        'Always look up the device first if needed, execute commands safely, and explain outputs clearly.'
    ),
    tools=[list_managed_devices, run_terminal_command],
)