import json
import asyncio
import sqlite3
from pathlib import Path
from google.adk.agents.llm_agent import Agent
from ws_manager import bridge_manager

DEFAULT_CLIENT_ID = "user_1"
DB_PATH = Path(__file__).parent.parent / "devices.db"

def _get_devices_from_db() -> list:
    """Read devices directly from the SQLite DB."""
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM devices").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def list_managed_devices() -> str:
    """
    Returns the list of all registered network devices (SSH and Serial), 
    their IDs, connection types, and active statuses.
    """
    try:
        devices = _get_devices_from_db()
        return json.dumps(devices, indent=2)
    except Exception as e:
        return f"Error fetching devices: {str(e)}"

async def run_terminal_command(device_identifier: str, command: str) -> str:
    """
    Executes a shell or terminal command on a specific managed device (by Name or Device ID)
    and returns the terminal output.
    """
    try:
        # Await the execution directly instead of using threadsafe/futures
        return await bridge_manager.execute_remote_command(
            client_id=DEFAULT_CLIENT_ID,
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