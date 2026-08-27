from google.adk.tools.tool_context import ToolContext as Context
from .client import get_gns3_project_details, gns3_request

def get_gns3_topology(ctx: Context) -> dict:
    """
    Retrieves all nodes and links in the active GNS3 project.
    Use this to understand the network structure before making changes.
    """
    try:
        gns3_project_id, server_url = get_gns3_project_details(ctx)
    except Exception as e:
        return {"error": str(e)}
        
    nodes = gns3_request(server_url, f"/projects/{gns3_project_id}/nodes")
    links = gns3_request(server_url, f"/projects/{gns3_project_id}/links")
    
    return {"project_id": gns3_project_id, "nodes": nodes, "links": links}

def get_gns3_templates(ctx: Context) -> dict | list:
    """
    Retrieves all available device templates from the GNS3 server.
    Use this to look up a template_id (e.g., for a 'switch' or 'router') before creating nodes.
    """
    try:
        # We only need the server URL to query global templates
        _, server_url = get_gns3_project_details(ctx)
    except Exception as e:
        return {"error": str(e)}
        
    templates = gns3_request(server_url, "/templates")
    return templates