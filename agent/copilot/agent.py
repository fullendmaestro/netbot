import json
import firebase_admin
from firebase_admin import firestore
from google.adk.agents.llm_agent import Agent
from google.adk.tools.tool_context import ToolContext as Context
from copilot.nornir_executor import run_command
from netmiko.exceptions import NetmikoAuthenticationException, NetmikoTimeoutException


def _get_devices_from_db(project_id: str) -> list:
    """Read devices directly from Firestore based on the active project."""
    if not project_id:
        return []

    db = firestore.client()
    docs = db.collection("projects").document(project_id).collection("devices").stream()

    devices = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        devices.append(d)

    return devices


def _find_device(devices: list, identifier: str) -> dict | None:
    """Find a device by name or id (case-insensitive)."""
    identifier_lower = identifier.lower()
    for d in devices:
        if d.get("id") == identifier or (d.get("name") or "").lower() == identifier_lower:
            return d
    return None


def _get_default_connection(device: dict) -> dict | None:
    """Return the default (or first non-serial) connection from a device."""
    connections = device.get("connections", [])
    # Prefer the explicitly marked default
    for c in connections:
        if c.get("isDefault"):
            return c
    # Fall back to first SSH or Telnet
    for c in connections:
        if c.get("type") in ("ssh", "telnet"):
            return c
    return None


def list_managed_devices(ctx: Context) -> str:
    """
    Returns the list of all registered network devices, their IDs,
    connection channels, and LibreNMS metadata (OS, hardware, etc.).
    """
    try:
        project_id = ctx.state.get("project_id")
        if not project_id:
            return "Error: No active project found in context state."

        devices = _get_devices_from_db(project_id)
        # Strip sensitive credentials before returning to LLM
        safe = []
        for d in devices:
            safe.append({
                "id": d.get("id"),
                "name": d.get("name"),
                "librenms": d.get("librenms"),
                "connections": [
                    {
                        "id": c.get("id"),
                        "label": c.get("label"),
                        "type": c.get("type"),
                        "host": c.get("host"),
                        "port": c.get("port"),
                        "isDefault": c.get("isDefault"),
                        "path": c.get("path"),
                    }
                    for c in d.get("connections", [])
                ],
            })
        return json.dumps(safe, indent=2)
    except Exception as e:
        return f"Error fetching devices: {str(e)}"


def execute_command(ctx: Context, device_identifier: str, command: str) -> str:
    """
    Executes a read-only show/display command on a managed network device
    (by name or device ID) via SSH or Telnet using Nornir + Netmiko.
    Netmiko automatically handles vendor-specific prompts, paging, and syntax.
    Returns the command output.
    """
    try:
        project_id = ctx.state.get("project_id")
        if not project_id:
            return "Error: No active project found in context state."

        devices = _get_devices_from_db(project_id)
        device = _find_device(devices, device_identifier)

        if not device:
            return f"Error: Device '{device_identifier}' not found. Use list_managed_devices to see available devices."

        connection = _get_default_connection(device)

        if not connection:
            return (
                f"Device '{device.get('name')}' has no network connection channels configured. "
                "If it is a serial-only device, please use the desktop terminal instead."
            )

        if connection.get("type") == "serial":
            return (
                f"Device '{device.get('name')}' is serial-only and cannot be reached by the agent directly. "
                "Please use the desktop terminal to interact with this device."
            )

        # Get OS hint from LibreNMS snapshot for Netmiko device_type mapping
        os_hint = (device.get("librenms") or {}).get("os")

        output = run_command(connection=connection, os_hint=os_hint, command=command)
        return output

    except NetmikoAuthenticationException:
        return (
            "Authentication failed. Please check the device credentials stored for this device."
        )
    except NetmikoTimeoutException:
        return (
            "Connection timed out. The device may not be reachable from the agent server. "
            "If the device is only accessible over a private network or internet, it may not be reachable."
        )
    except ConnectionRefusedError:
        return (
            "Connection refused. The device may not be reachable or the port may be incorrect. "
            "If the agent server cannot reach the device over the network, it will not be able to connect."
        )
    except Exception as e:
        err = str(e) or repr(e)
        return f"Error executing command: {err}"


root_agent = Agent(
    model="gemini-2.5-flash",
    name="root_agent",
    description="A network engineering assistant that can inspect managed network devices.",
    instruction=(
        "You are Netbot, an intelligent network copilot. "
        "You have access to tools to list registered devices (`list_managed_devices`) "
        "and execute read-only show/display commands on them (`execute_command`). "
        "Always look up the device list first if you need to identify a device. "
        "Execute only read-only, non-destructive commands. "
        "Explain command outputs clearly and concisely. "
        "If a device is not reachable, inform the user and suggest checking the network path. "
        "Do not attempt configuration changes — this tool is for inspection only."
    ),
    tools=[list_managed_devices, execute_command],
)