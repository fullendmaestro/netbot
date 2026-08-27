from typing import Any
from google.adk.tools.tool_context import ToolContext as Context
from .client import get_gns3_project_details, gns3_request

def create_gns3_nodes(ctx: Context, nodes: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Creates multiple nodes in the active GNS3 project using specified templates and coordinates.
    
    Args:
        ctx: The ADK ToolContext (injected automatically).
        nodes: A list of dictionaries, each containing:
               - template_id (str): The UUID of the template to use.
               - x (int/float): The X coordinate.
               - y (int/float): The Y coordinate.
               - compute_id (str, optional): The compute ID, defaults to 'local'.
    
    IMPORTANT: Ensure the distance between any two nodes is greater than 250 pixels.
    This spacing is necessary to display interface numbers clearly for better topology visualization.
    
    Returns:
        A dictionary with creation results for all nodes, including success/failure statuses.
    """
    try:
        gns3_project_id, server_url = get_gns3_project_details(ctx)
    except Exception as e:
        return {"error": str(e)}

    if not nodes or not isinstance(nodes, list):
        return {"error": "The 'nodes' argument must be a non-empty array."}

    results = []
    
    for i, node_data in enumerate(nodes):
        try:
            template_id = node_data.get("template_id")
            x = node_data.get("x", 0)
            y = node_data.get("y", 0)
            compute_id = node_data.get("compute_id", "local")

            if not template_id:
                results.append({
                    "status": "failed", 
                    "error": f"Node {i + 1} missing required 'template_id'."
                })
                continue

            # In the GNS3 API, creating a node from a template uses the template POST endpoint
            endpoint = f"/projects/{gns3_project_id}/templates/{template_id}"
            payload = {
                "x": int(x),
                "y": int(y),
                "compute_id": compute_id
            }

            response = gns3_request(server_url, endpoint, method="POST", payload=payload)
            
            results.append({
                "node_id": response.get("node_id"),
                "name": response.get("name"),
                "status": "success"
            })

        except Exception as e:
            results.append({
                "status": "failed",
                "error": f"Node {i + 1} creation failed: {str(e)}"
            })

    successful_nodes = sum(1 for r in results if r.get("status") == "success")
    failed_nodes = len(nodes) - successful_nodes

    return {
        "project_id": gns3_project_id,
        "created_nodes": results,
        "total_nodes": len(nodes),
        "successful_nodes": successful_nodes,
        "failed_nodes": failed_nodes
    }