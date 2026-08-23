import sqlite3
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/devices", tags=["devices"])

DB_PATH = Path(__file__).parent.parent / "devices.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS devices (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                type        TEXT NOT NULL,
                host        TEXT,
                port        INTEGER,
                username    TEXT,
                authType    TEXT,
                password    TEXT,
                privateKey  TEXT,
                path        TEXT,
                baudRate    INTEGER
            )
        """)
        conn.commit()


_init_db()


class DeviceIn(BaseModel):
    id: Optional[str] = None
    name: str
    type: str  # 'ssh' | 'serial'
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    authType: Optional[str] = None
    password: Optional[str] = None
    privateKey: Optional[str] = None
    path: Optional[str] = None
    baudRate: Optional[int] = None
    # connectionStatus is UI-only; not persisted
    connectionStatus: Optional[str] = None


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["connectionStatus"] = "Offline"
    return d


@router.get("")
async def list_devices():
    """Return all registered devices."""
    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM devices").fetchall()
    return [_row_to_dict(r) for r in rows]


@router.post("", status_code=201)
async def add_device(device: DeviceIn):
    """Register a new device."""
    device_id = device.id or str(uuid.uuid4())
    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO devices
                (id, name, type, host, port, username, authType, password, privateKey, path, baudRate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                device_id,
                device.name,
                device.type,
                device.host,
                device.port,
                device.username,
                device.authType,
                device.password,
                device.privateKey,
                device.path,
                device.baudRate,
            ),
        )
        conn.commit()
    return {"id": device_id}


@router.delete("/{device_id}", status_code=204)
async def remove_device(device_id: str):
    """Remove a device by ID."""
    with _get_conn() as conn:
        result = conn.execute(
            "DELETE FROM devices WHERE id = ?", (device_id,)
        )
        conn.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Device not found")
