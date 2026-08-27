import os
import json
import urllib.request
import urllib.error
from google.adk.tools.tool_context import ToolContext as Context

def get_gns3_project_details(ctx: Context) -> tuple[str, str]:
    """
    Retrieves the active GNS3 project ID directly from the ADK context state.
    The GNS3 Server URL is retrieved from the environment.
    """
    gns3_project_id = ctx.state.get('gns3_project_id')
    
    if not gns3_project_id:
        raise ValueError("No active GNS3 project ID found in context state. Ensure the frontend passes 'gns3_project_id' in stateDelta.")
        
    gns3_server_url = os.environ.get("GNS3_SERVER_URL", "http://localhost:3080")
    
    return gns3_project_id, gns3_server_url

def gns3_request(server_url: str, endpoint: str, method: str = 'GET', payload: dict = None) -> dict | list:
    """
    A lightweight HTTP client for the GNS3 API, bypassing complex gns3fy/connector models.
    """
    base_url = server_url.rstrip('/')
    url = f"{base_url}/v2{endpoint}"
    
    headers = {'Accept': 'application/json'}
    data = None
    
    if payload:
        data = json.dumps(payload).encode('utf-8')
        headers['Content-Type'] = 'application/json'
        
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    
    try:
        with urllib.request.urlopen(req, timeout=10.0) as response:
            response_body = response.read().decode('utf-8')
            if response_body:
                return json.loads(response_body)
            return {}
    except urllib.error.URLError as e:
        error_msg = str(e)
        if hasattr(e, 'read'):
            try:
                error_body = e.read().decode('utf-8')
                error_msg = f"{error_msg} - {error_body}"
            except Exception:
                pass
        raise RuntimeError(f"GNS3 API Error ({method} {url}): {error_msg}")