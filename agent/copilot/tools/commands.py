import json
from typing import Any
from google.adk.tools.tool_context import ToolContext as Context
from ..db import get_devices_from_db, find_device, get_default_connection
from ..nornir_executor import run_batch_commands

def execute_command(ctx: Context, device_identifier: str, command: str) -> str:
    """
    Executes a single read-only show/display command on a targeted network device.
    Use this for quick, isolated queries on a single device rather than batch jobs.
    
    IMPORTANT STRICT GUARDRAILS:
    1. READ-ONLY ONLY: Do not execute configuration changes (e.g., 'conf t').
    2. NON-INTERACTIVE: Output must exit immediately without pagination.
    
    Args:
        device_identifier: The name or ID of the device (e.g., 'R-1').
        command: The specific command to run (e.g., 'show ip route').
    """
    project_id = ctx.state.get("project_id")
    if not project_id:
        return "Error: No active project found in context state."

    devices_db = get_devices_from_db(project_id)
    device = find_device(devices_db, device_identifier)

    if not device:
        return f"Error: Device '{device_identifier}' not found. Use list_managed_devices to see available devices."

    connection = get_default_connection(device)
    if not connection:
        return f"Error: Device '{device.get('name')}' has no network connection channels configured."

    if connection.get("type") == "serial":
        return f"Error: Device '{device.get('name')}' is serial-only and cannot be reached by the agent directly."

    # Wrap the single command in the batch config schema to reuse the resilient executor
    batch_config = [{
        "id": device.get("id"),
        "connection": connection,
        "os_hint": (device.get("librenms") or {}).get("os"),
        "commands": [command]
    }]

    try:
        execution_results = run_batch_commands(batch_config)
        dev_id = device.get("id")
        
        if dev_id in execution_results:
            result = execution_results[dev_id]
            if "error" in result:
                return f"Execution failed: {result['error']}"
            return result.get(command, "No output returned.")
            
        return "Error: Command execution yielded no results."
    except Exception as e:
        return f"Error executing command: {str(e)}"


def execute_multiple_commands(ctx: Context, execution_plan: list[dict[str, Any]]) -> str:
    """
    Batch executes read-only display/show commands concurrently across multiple network devices.
    
    IMPORTANT STRICT GUARDRAILS:
    1. READ-ONLY ONLY: Absolutely no configuration commands (e.g., 'conf t', 'ip address').
    2. NON-INTERACTIVE: Do not use commands that require user prompts or pagination (e.g., avoid 'top', use 'ping -c 3').
    
    Args:
        execution_plan: A list of dictionaries defining the target devices and commands.
        Example schema:
        [
            {
                "device_identifier": "R-1", 
                "commands": ["show ip interface brief", "show version"]
            }
        ]
    """
    project_id = ctx.state.get("project_id")
    if not project_id:
        return json.dumps({"error": "No active project found in context state."})

    devices_db = get_devices_from_db(project_id)
    batch_configs = []
    results_summary = []

    for plan in execution_plan:
        target_id = plan.get("device_identifier")
        commands = plan.get("commands", [])
        
        device = find_device(devices_db, target_id)
        if not device:
            results_summary.append({"device": target_id, "status": "failed", "error": "Device not found."})
            continue

        connection = get_default_connection(device)
        if not connection or connection.get("type") == "serial":
            results_summary.append({
                "device": target_id, 
                "status": "failed", 
                "error": "No valid remote connection (serial-only or missing)."
            })
            continue

        batch_configs.append({
            "id": device.get("id"),
            "connection": connection,
            "os_hint": (device.get("librenms") or {}).get("os"),
            "commands": commands
        })

    if not batch_configs:
        return json.dumps({"execution_results": results_summary})

    try:
        execution_results = run_batch_commands(batch_configs)
        
        for config in batch_configs:
            dev_id = config["id"]
            if dev_id in execution_results:
                results_summary.append({
                    "device_id": dev_id,
                    "status": "success" if "error" not in execution_results[dev_id] else "partial_failure",
                    "outputs": execution_results[dev_id]
                })
                
    except Exception as e:
        return json.dumps({"error": f"Critical execution failure: {str(e)}", "partial_results": results_summary})

    return json.dumps({"execution_results": results_summary}, indent=2)