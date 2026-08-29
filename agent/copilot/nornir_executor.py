"""
nornir_executor.py

Builds a per-call Nornir inventory from a DeviceConnection dict,
maps the device OS to a Netmiko device_type, and executes a single
read-only command via netmiko_send_command.
"""
from __future__ import annotations

from nornir import Nornir
from nornir.core.configuration import Config
from nornir.core.inventory import Inventory
from nornir_netmiko.tasks import netmiko_send_command
from nornir.core.task import Task, Result
from netmiko.exceptions import (
    NetmikoAuthenticationException,
    NetmikoTimeoutException,
)

# LibreNMS os → Netmiko device_type mapping
OS_MAP: dict[str, str] = {
    "ios": "cisco_ios",
    "iosxe": "cisco_xe",
    "iosxr": "cisco_xr",
    "nxos": "cisco_nxos",
    "asa": "cisco_asa",
    "junos": "juniper_junos",
    "routeros": "mikrotik_routeros",
    "edgeos": "ubiquiti_edge",
    "arubaos": "aruba_os",
    "linux": "linux",
    "windows": "generic",
}


def _resolve_device_type(connection_type: str, os_hint: str | None) -> str:
    """
    Determine the Netmiko device_type.
    - For SSH: use OS mapping or fall back to autodetect.
    - For Telnet: append _telnet suffix to the resolved type.
    """
    base = OS_MAP.get((os_hint or "").lower(), "autodetect")
    if connection_type == "telnet":
        return base if base == "autodetect" else f"{base}_telnet"
    return base


def run_command(connection: dict, os_hint: str | None, command: str) -> str:
    """
    Execute a single read-only command on a device using Nornir + Netmiko.

    Args:
        connection: A DeviceConnection dict (keys: type, host, port, username, password, etc.)
        os_hint:    The `os` value from librenms snapshot (e.g. "ios", "junos").
        command:    The command string to execute.

    Returns:
        Command output as a string.

    Raises:
        NetmikoAuthenticationException: on auth failure.
        NetmikoTimeoutException: on connection timeout.
        Exception: on any other error.
    """
    conn_type = connection.get("type", "ssh")
    device_type = _resolve_device_type(conn_type, os_hint)

    host = connection.get("host", "")
    port = connection.get("port") or (22 if conn_type == "ssh" else 23)
    username = connection.get("username", "")
    password = connection.get("password", "")

    hosts = {
        "device": {
            "hostname": host,
            "port": port,
            "username": username,
            "password": password,
            "platform": device_type,
            "connection_options": {
                "netmiko": {
                    "extras": {
                        "device_type": device_type,
                    }
                }
            },
        }
    }

    # Initialize Nornir natively using the core Inventory and Config classes
    inventory = Inventory(hosts=hosts, groups={}, defaults={})
    config = Config(runner={"plugin": "serial"}, logging={"enabled": False})
    nr = Nornir(inventory=inventory, config=config, dry_run=False)

    result = nr.run(task=netmiko_send_command, command_string=command)
    host_result = result["device"]

    if host_result.failed:
        exc = host_result.exception
        if exc:
            raise exc
        raise Exception(f"Command execution failed: {host_result}")

    return str(host_result.result).strip()