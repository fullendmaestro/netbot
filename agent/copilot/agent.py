import urllib.request
from google.adk.agents.llm_agent import Agent

import time
import json
import sqlite3
from pathlib import Path

BRIDGE_URL = "http://127.0.0.1:3001"
DB_PATH = Path(__file__).parent.parent / "devices.db"


def _get_devices_from_db() -> list:
    """Read devices directly from the SQLite DB — avoids HTTP self-call deadlock."""
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute("SELECT * FROM devices").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def web_search(query: str) -> str: 
    """
    Searches the web for information related to the query and returns search results.
    
    Args:
        query: The search term or question to look up on the web.
    """
    # Simulate a network delay of 2.5 seconds
    time.sleep(2.5)
    
    dummy_data = {
        "results": [
            {
                "title": f"Top result for '{query}'",
                "url": "https://example.com/top-result",
                "snippet": f"This is a dummy search snippet providing information about {query}."
            },
            {
                "title": f"More information on {query}",
                "url": "https://example.com/more-info",
                "snippet": "Here is some additional context and technical details regarding your search."
            }
        ]
    }
    return json.dumps(dummy_data)

def list_managed_devices() -> str:
    """
    Returns the list of all registered network devices (SSH and Serial), 
    their IDs, connection types, and active connection statuses.
    """
    try:
        devices = _get_devices_from_db()
        return json.dumps(devices, indent=2)
    except Exception as e:
        return f"Error fetching devices: {str(e)}"

def run_terminal_command(device_identifier: str, command: str) -> str:
    """
    Executes a shell or terminal command on a specific managed device (by Name or Device ID)
    and returns the terminal output.

    Args:
        device_identifier: The name or UUID of the device.
        command: The command line string to execute (e.g. 'show ip interface brief', 'uname -a', 'ifconfig').
    """
    try:
        payload = json.dumps({
            "deviceName": device_identifier,
            "deviceId": device_identifier,
            "command": command,
            "timeoutMs": 3500
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{BRIDGE_URL}/api/execute-command",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode())
            return result.get("output", "Command executed with no output.")
    except Exception as e:
        return f"Error executing command: {str(e)}"

root_agent = Agent(
    model='gemini-2.5-flash',
    name='root_agent',
    description='A network engineering assistant capable of inspecting and interacting with connected devices.',
    instruction=(
        'You are Netbot, an intelligent network and system copilot. '
        'You have tools to list devices (`list_managed_devices`) and execute terminal commands '
        '(`run_terminal_command`) on SSH and Serial connected devices. '
        'When the user asks to inspect a device or run a command, always look up the device first if needed, '
        'execute the command safely, and explain the terminal output clearly to the user.'
    ),
    tools=[list_managed_devices, run_terminal_command, web_search],
)