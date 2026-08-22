import urllib.request
import json
from google.adk.agents.llm_agent import Agent

BRIDGE_URL = "http://127.0.0.1:3001"

def list_managed_devices() -> str:
    """
    Returns the list of all registered network devices (SSH and Serial), 
    their IDs, connection types, and active connection statuses.
    """
    try:
        req = urllib.request.Request(f"{BRIDGE_URL}/api/devices", method="GET")
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            return json.dumps(data, indent=2)
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
    tools=[list_managed_devices, run_terminal_command],
)