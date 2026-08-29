import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from firebase_admin import firestore
from api.auth import verify_token

router = APIRouter(prefix="/api/librenms", tags=["librenms"])

LIBRENMS_URL = os.getenv("LIBRENMS_URL", "").rstrip("/")
LIBRENMS_TOKEN = os.getenv("LIBRENMS_TOKEN", "")

def _lnms_headers() -> dict:
    if not LIBRENMS_TOKEN:
        raise HTTPException(status_code=503, detail="LibreNMS is not configured on this server.")
    return {"X-Auth-Token": LIBRENMS_TOKEN, "Content-Type": "application/json"}


async def _lnms_get(path: str, params: dict = None) -> dict:
    """Forward a GET request to LibreNMS."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{LIBRENMS_URL}/api/v0{path}", headers=_lnms_headers(), params=params)
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Device not found in LibreNMS.")
    if not resp.is_success:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()


# ─────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────

class DeviceConnection(BaseModel):
    id: str
    label: Optional[str] = None
    type: str                    # ssh | telnet | serial
    isDefault: bool = False
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    authType: Optional[str] = "password"
    privateKey: Optional[str] = None
    path: Optional[str] = None
    baudRate: Optional[int] = None


class CreateDeviceRequest(BaseModel):
    netbotProjectId: str
    hostname: str
    name: Optional[str] = None
    # SNMP v1/v2c
    snmpver: Optional[str] = "v2c"
    community: Optional[str] = None
    # SNMP v3
    authlevel: Optional[str] = None
    authname: Optional[str] = None
    authpass: Optional[str] = None
    authalgo: Optional[str] = None
    cryptopass: Optional[str] = None
    cryptoalgo: Optional[str] = None
    # Connection channels
    connections: Optional[list[DeviceConnection]] = []


# ─────────────────────────────────────────────
# Device CRUD
# ─────────────────────────────────────────────

@router.post("/devices")
async def create_device(req: CreateDeviceRequest, _user=Depends(verify_token)):
    """
    1. Register device in LibreNMS (SNMP credentials required).
    2. Fetch canonical record back from LibreNMS.
    3. Store minimal librenms snapshot + connection channels in Firestore.
    Rolls back LibreNMS if Firestore write fails.
    """
    if not LIBRENMS_URL:
        raise HTTPException(status_code=503, detail="LibreNMS is not configured on this server.")

    # Build LibreNMS payload
    lnms_payload: dict = {
        "hostname": req.hostname,
        "snmpver": req.snmpver or "v2c",
    }
    if req.community:
        lnms_payload["community"] = req.community
    if req.authlevel:
        lnms_payload.update({
            "authlevel": req.authlevel,
            "authname": req.authname,
            "authpass": req.authpass,
            "authalgo": req.authalgo,
            "cryptopass": req.cryptopass,
            "cryptoalgo": req.cryptoalgo,
        })

    # Step 1: Create in LibreNMS
    async with httpx.AsyncClient(timeout=30.0) as client:
        lnms_resp = await client.post(
            f"{LIBRENMS_URL}/api/v0/devices",
            headers=_lnms_headers(),
            json=lnms_payload
        )

    if not lnms_resp.is_success:
        detail = lnms_resp.json().get("message", lnms_resp.text)
        raise HTTPException(status_code=400, detail=f"LibreNMS error: {detail}")

    # Step 2: Fetch canonical device record from LibreNMS
    lnms_device = {}
    try:
        data = await _lnms_get(f"/devices/{req.hostname}")
        devices = data.get("devices", [])
        if devices:
            lnms_device = devices[0]
    except Exception:
        pass  # Non-fatal — we still have the hostname

    # Step 3: Build Firestore document
    import uuid
    device_id = str(uuid.uuid4())
    librenms_snapshot = {
        "device_id": lnms_device.get("device_id"),
        "hostname": lnms_device.get("hostname", req.hostname),
        "sysName": lnms_device.get("sysName"),
        "sysDescr": lnms_device.get("sysDescr"),
        "hardware": lnms_device.get("hardware"),
        "os": lnms_device.get("os"),
        "icon": lnms_device.get("icon"),
    }
    # Strip None values
    librenms_snapshot = {k: v for k, v in librenms_snapshot.items() if v is not None}

    firestore_doc = {
        "name": req.name or lnms_device.get("sysName") or req.hostname,
        "connections": [c.model_dump() for c in req.connections],
        "librenms": librenms_snapshot,
    }

    try:
        db = firestore.client()
        db.collection("projects").document(req.netbotProjectId) \
          .collection("devices").document(device_id).set(firestore_doc)
    except Exception as e:
        # Rollback: delete from LibreNMS
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.delete(
                    f"{LIBRENMS_URL}/api/v0/devices/{req.hostname}",
                    headers=_lnms_headers()
                )
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Firestore write failed (LibreNMS device rolled back): {e}")

    return {"id": device_id, **firestore_doc}


@router.delete("/devices/{hostname}")
async def delete_device(hostname: str, netbot_project_id: str = Query(...), firestore_device_id: str = Query(...), _user=Depends(verify_token)):
    """Remove device from LibreNMS and Firestore."""
    # Delete from LibreNMS
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.delete(f"{LIBRENMS_URL}/api/v0/devices/{hostname}", headers=_lnms_headers())
    if not resp.is_success and resp.status_code != 404:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    # Delete from Firestore
    db = firestore.client()
    db.collection("projects").document(netbot_project_id) \
      .collection("devices").document(firestore_device_id).delete()

    return {"status": "ok", "message": f"Device {hostname} removed."}


# ─────────────────────────────────────────────
# DeviceDetail tab proxies
# ─────────────────────────────────────────────

@router.get("/devices/{hostname}/overview")
async def get_device_overview(hostname: str, _user=Depends(verify_token)):
    """Proxy: GET /api/v0/devices/{hostname}"""
    return await _lnms_get(f"/devices/{hostname}")


@router.get("/devices/{hostname}/ports")
async def get_device_ports(hostname: str, _user=Depends(verify_token)):
    """Proxy: GET /api/v0/devices/{hostname}/ports"""
    return await _lnms_get(f"/devices/{hostname}/ports")


@router.get("/devices/{hostname}/alerts")
async def get_device_alerts(hostname: str, _user=Depends(verify_token)):
    """Proxy: GET /api/v0/alerts?hostname={hostname}&state=1"""
    return await _lnms_get("/alerts", params={"hostname": hostname, "state": 1})
