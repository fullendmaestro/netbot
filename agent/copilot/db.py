import firebase_admin
from firebase_admin import firestore

def get_devices_from_db(project_id: str) -> list:
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

def find_device(devices: list, identifier: str) -> dict | None:
    """Find a device by name or id (case-insensitive)."""
    identifier_lower = identifier.lower()
    for d in devices:
        if d.get("id") == identifier or (d.get("name") or "").lower() == identifier_lower:
            return d
    return None

def get_default_connection(device: dict) -> dict | None:
    """Return the default (or first non-serial) connection from a device."""
    connections = device.get("connections", [])
    for c in connections:
        if c.get("isDefault"):
            return c
    for c in connections:
        if c.get("type") in ("ssh", "telnet"):
            return c
    return None