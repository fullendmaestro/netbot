import json
from google.adk.tools.tool_context import ToolContext as Context
from ..db import get_devices_from_db

def list_managed_devices(ctx: Context) -> str:
    """
    Retrieves the complete list of registered network devices, their IDs,
    connection channels, and hardware metadata for the active project.
    
    Always call this tool first if you need to identify device IDs or check connectivity options.
    """
    try:
        project_id = ctx.state.get("project_id")
        if not project_id:
            return json.dumps({"error": "No active project found in context state."})

        devices = get_devices_from_db(project_id)
        safe = [
            {
                "id": d.get("id"),
                "name": d.get("name"),
                "os": (d.get("librenms") or {}).get("os", "unknown"),
                "connections": [
                    {k: v for k, v in c.items() if k in ("id", "label", "type", "host", "port", "isDefault")}
                    for c in d.get("connections", [])
                ],
            }
            for d in devices
        ]
        return json.dumps(safe)
    except Exception as e:
        return json.dumps({"error": f"Failed to fetch devices: {str(e)}"})