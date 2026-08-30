from __future__ import annotations
import logging
from typing import Any

from nornir import InitNornir
from nornir.core.plugins.inventory import InventoryPluginRegister
from nornir.core.inventory import Inventory, Hosts, Groups, Defaults, Host, Group
from nornir_netmiko.tasks import netmiko_send_command
from nornir_netmiko.tasks import netmiko_send_config
from nornir.core.task import Task, Result
from netmiko.exceptions import NetmikoAuthenticationException, NetmikoTimeoutException, ReadTimeout

logger = logging.getLogger(__name__)

class DictInventory:
    def __init__(self, hosts: dict = None, groups: dict = None, defaults: dict = None, **kwargs):
        self.hosts_dict = hosts or {}
        self.groups_dict = groups or {}
        self.defaults_dict = defaults or {}

    def _parse_connection_options(self, data: dict) -> dict:
        from nornir.core.inventory import ConnectionOptions
        if "connection_options" in data:
            opts = {k: ConnectionOptions(**v) for k, v in data["connection_options"].items()}
            data["connection_options"] = opts
        return data

    def load(self) -> Inventory:
        hosts = Hosts({name: Host(name=name, **self._parse_connection_options(h)) for name, h in self.hosts_dict.items()})
        groups = Groups({name: Group(name=name, **self._parse_connection_options(g)) for name, g in self.groups_dict.items()})
        defaults = Defaults(**self._parse_connection_options(self.defaults_dict))
        return Inventory(hosts=hosts, groups=groups, defaults=defaults)

InventoryPluginRegister.register("DictInventory", DictInventory)

OS_MAP: dict[str, str] = {
    "ios": "cisco_ios", "iosxe": "cisco_xe", "nxos": "cisco_nxos",
    "junos": "juniper_junos", "linux": "linux", "windows": "generic",
}

def _resolve_device_type(connection_type: str, os_hint: str | None) -> str:
    base = OS_MAP.get((os_hint or "").lower(), "autodetect")
    return f"{base}_telnet" if connection_type == "telnet" and base != "autodetect" else base

def _robust_netmiko_task(task: Task, commands_map: dict[str, list[str]]) -> Result:
    """Executes commands with a single-retry mechanism for prompt detection stability."""
    outputs = {}
    
    # Extract the specific commands for this current device
    commands = commands_map.get(task.host.name, [])
    
    for cmd in commands:
        try:
            # Use timing mode with delay factor to ensure stability on slow compute instances
            result = task.run(
                task=netmiko_send_command, 
                command_string=cmd,
                use_timing=True,
                delay_factor=2
            )
            outputs[cmd] = result.result
        except ReadTimeout as e:
            logger.warning(f"Timeout on {task.host.name} for '{cmd}'. Retrying once...")
            try:
                result = task.run(task=netmiko_send_command, command_string=cmd, use_timing=True, delay_factor=4)
                outputs[cmd] = result.result
            except Exception as retry_e:
                outputs[cmd] = f"Command failed after retry (Timeout): {str(retry_e)}"
        except Exception as e:
            outputs[cmd] = f"Command failed: {str(e)}"
            
    return Result(host=task.host, result=outputs)
def run_batch_commands(device_configs: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    """
    Executes multiple commands across multiple devices concurrently.
    
    Args:
        device_configs: List of dicts containing 'connection', 'os_hint', and 'commands'.
    """
    hosts_inventory = {}
    commands_map = {}

    for config in device_configs:
        conn = config["connection"]
        device_id = config["id"]
        conn_type = conn.get("type", "ssh")
        device_type = _resolve_device_type(conn_type, config.get("os_hint"))
        
        hosts_inventory[device_id] = {
            "hostname": conn.get("host", ""),
            "port": conn.get("port") or (22 if conn_type == "ssh" else 23),
            "username": conn.get("username", ""),
            "password": conn.get("password", ""),
            "platform": device_type,
            "connection_options": {"netmiko": {"extras": {"device_type": device_type}}},
        }
        commands_map[device_id] = config.get("commands", [])

    if not hosts_inventory:
        return {}

    nr = InitNornir(
        inventory={"plugin": "DictInventory", "options": {"hosts": hosts_inventory}},
        runner={"plugin": "threaded", "options": {"num_workers": 10}},
        logging={"enabled": False},
    )

    task_result = nr.run(task=_robust_netmiko_task, commands_map=commands_map)
    
    final_results = {}
    for host, multi_result in task_result.items():
        if multi_result.failed:
            final_results[host] = {"error": str(multi_result.exception or multi_result[0].result)}
        else:
            final_results[host] = multi_result[0].result

    return final_results


def _robust_netmiko_config_task(task: Task, commands_map: dict[str, list[str]]) -> Result:
    """Executes configuration commands with a single-retry mechanism for prompt detection stability."""
    outputs = {}
    config_commands = commands_map.get(task.host.name, [])
    
    if not config_commands:
        return Result(host=task.host, result={"error": "No configuration commands provided."})

    try:
        result = task.run(
            task=netmiko_send_config, 
            config_commands=config_commands
        )
        outputs["execution_result"] = result.result
    except ReadTimeout as e:
        logger.warning(f"Timeout on {task.host.name} during config. Retrying once...")
        try:
            result = task.run(
                task=netmiko_send_config, 
                config_commands=config_commands
            )
            outputs["execution_result"] = result.result
        except Exception as retry_e:
            outputs["error"] = f"Config failed after retry (Timeout): {str(retry_e)}"
    except Exception as e:
        # Retry on transient prompt failures commonly seen in virtualized IOS nodes
        if "netmiko_send_config (failed)" in str(e):
             try:
                 result = task.run(task=netmiko_send_config, config_commands=config_commands)
                 outputs["execution_result"] = result.result
             except Exception as inner_e:
                 outputs["error"] = f"Config failed: {str(inner_e)}"
        else:
            outputs["error"] = f"Config failed: {str(e)}"
            
    return Result(host=task.host, result=outputs)


def run_batch_config_commands(device_configs: list[dict[str, Any]]) -> dict[str, dict[str, str]]:
    """
    Executes multiple configuration commands across multiple devices concurrently.
    """
    hosts_inventory = {}
    commands_map = {}

    for config in device_configs:
        conn = config["connection"]
        device_id = config["id"]
        conn_type = conn.get("type", "ssh")
        device_type = _resolve_device_type(conn_type, config.get("os_hint"))
        
        hosts_inventory[device_id] = {
            "hostname": conn.get("host", ""),
            "port": conn.get("port") or (22 if conn_type == "ssh" else 23),
            "username": conn.get("username", ""),
            "password": conn.get("password", ""),
            "platform": device_type,
            "connection_options": {"netmiko": {"extras": {"device_type": device_type}}},
        }
        commands_map[device_id] = config.get("commands", [])

    if not hosts_inventory:
        return {}

    nr = InitNornir(
        inventory={"plugin": "DictInventory", "options": {"hosts": hosts_inventory}},
        runner={"plugin": "threaded", "options": {"num_workers": 10}},
        logging={"enabled": False},
    )

    task_result = nr.run(task=_robust_netmiko_config_task, commands_map=commands_map)
    
    final_results = {}
    for host, multi_result in task_result.items():
        if multi_result.failed:
            final_results[host] = {"error": str(multi_result.exception or multi_result[0].result)}
        else:
            final_results[host] = multi_result[0].result

    return final_results