import uuid
import json
import urllib.request
import urllib.error
import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from firebase_admin import firestore

router = APIRouter(prefix="/api/gns3", tags=["gns3"])

class CreateProjectRequest(BaseModel):
    name: str
    gns3ServerUrl: str
    netbotProjectId: str

@router.post("/projects")
async def create_gns3_project(req: CreateProjectRequest):
    gns3_project_id = str(uuid.uuid4())
    url = f"{req.gns3ServerUrl.rstrip('/')}/v2/projects"
    
    payload = {
        "name": f"{req.name}",
        "project_id": gns3_project_id
    }
    
    data = json.dumps(payload).encode('utf-8')
    req_obj = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    
    try:
        with urllib.request.urlopen(req_obj, timeout=10.0) as response:
            response.read()
    except urllib.error.URLError as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project in GNS3: {str(e)}")
            
    # Save to Firestore
    db = firestore.client()
    doc_ref = db.collection("projects").document(req.netbotProjectId).collection("gns3_projects").document(gns3_project_id)
    doc_ref.set({
        "id": gns3_project_id,
        "name": req.name,
        "createdAt": datetime.datetime.utcnow().isoformat()
    })
    
    return {"id": gns3_project_id, "name": req.name}
