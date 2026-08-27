import math
from typing import Any
from google.adk.tools.tool_context import ToolContext as Context
from .client import get_gns3_project_details, gns3_request

def create_gns3_drawings(ctx: Context, drawings: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Creates multiple arbitrary SVG drawings in the active GNS3 project.
    
    Args:
        ctx: The ADK ToolContext (injected automatically).
        drawings: A list of dictionaries containing svg, x, y, z, locked, and rotation parameters.
    """
    try:
        gns3_project_id, server_url = get_gns3_project_details(ctx)
    except Exception as e:
        return {"error": str(e)}

    if not drawings or not isinstance(drawings, list):
        return {"error": "The 'drawings' argument must be a non-empty array."}

    results = []

    for i, drawing_data in enumerate(drawings):
        try:
            svg = drawing_data.get("svg")
            x = drawing_data.get("x", 0)
            y = drawing_data.get("y", 0)

            if not svg:
                results.append({"status": "failed", "error": f"Drawing {i + 1} missing 'svg'."})
                continue

            payload = {
                "svg": svg,
                "x": int(x),
                "y": int(y),
                "z": int(drawing_data.get("z", 0)),
                "locked": bool(drawing_data.get("locked", False)),
                "rotation": int(drawing_data.get("rotation", 0))
            }

            response = gns3_request(server_url, f"/projects/{gns3_project_id}/drawings", method="POST", payload=payload)
            
            results.append({
                "drawing_id": response.get("drawing_id"),
                "status": "success"
            })

        except Exception as e:
            results.append({
                "status": "failed",
                "error": f"Drawing {i + 1} creation failed: {str(e)}"
            })

    successful = sum(1 for r in results if r.get("status") == "success")
    return {
        "project_id": gns3_project_id,
        "created_drawings": results,
        "total_drawings": len(drawings),
        "successful_drawings": successful,
        "failed_drawings": len(drawings) - successful
    }

def _generate_area_payloads(node1: dict, node2: dict, area_name: str, shape_type: str) -> list[dict]:
    """Helper to calculate the bounding box, rotation, and SVG payload for two-node logical areas."""
    x1, y1 = node1.get('x', 0), node1.get('y', 0)
    x2, y2 = node2.get('x', 0), node2.get('y', 0)
    
    cx = int((x1 + x2) / 2)
    cy = int((y1 + y2) / 2)
    
    dx = x2 - x1
    dy = y2 - y1
    dist = math.hypot(dx, dy)
    angle = math.degrees(math.atan2(dy, dx))
    
    # Semantic colors
    color = "#2196F3" if any(k in area_name.upper() for k in ["BGP", "AS", "AREA 0"]) else "#9C27B0"
    if "VLAN" in area_name.upper() or "VRF" in area_name.upper():
        color = "#FFC107"
        
    rx, ry = int(dist / 2) + 60, 80
    
    if shape_type == "rectangle":
        shape_svg = f'<svg height="{ry*2}" width="{rx*2}"><rect x="2" y="2" width="{rx*2-4}" height="{ry*2-4}" fill="{color}" fill-opacity="0.1" stroke="{color}" stroke-width="2" stroke-dasharray="5,5"/></svg>'
    else:
        shape_svg = f'<svg height="{ry*2}" width="{rx*2}"><ellipse cx="{rx}" cy="{ry}" rx="{rx-2}" ry="{ry-2}" fill="{color}" fill-opacity="0.1" stroke="{color}" stroke-width="2"/></svg>'
        
    text_svg = f'<svg height="30" width="150"><text x="10" y="20" font-family="sans-serif" font-size="14" font-weight="bold" fill="{color}">{area_name}</text></svg>'

    return [
        {"svg": shape_svg, "x": cx - rx, "y": cy - ry, "z": -1, "locked": False, "rotation": int(angle)},
        {"svg": text_svg, "x": cx - 40, "y": cy - ry - 30, "z": 1, "locked": False, "rotation": 0}
    ]

def create_gns3_area_drawing(ctx: Context, area_name: str, node_names: list[str], shape_type: str = "ellipse") -> dict[str, Any]:
    """
    Creates a visual annotation (ellipse or rectangle) to mark logical groupings between two network devices.
    
    Args:
        ctx: The ADK ToolContext.
        area_name: Logical group name (e.g., "Area 0", "VLAN 10").
        node_names: List of exactly 2 node names (e.g., ["R-1", "R-2"]).
        shape_type: "ellipse" (default) or "rectangle".
    """
    try:
        gns3_project_id, server_url = get_gns3_project_details(ctx)
    except Exception as e:
        return {"error": str(e)}

    if not isinstance(node_names, list) or len(node_names) != 2:
        return {"error": f"Exactly 2 node names are required, got {len(node_names) if isinstance(node_names, list) else 'invalid type'}."}

    try:
        # Fetch all nodes to find coordinates
        nodes_data = gns3_request(server_url, f"/projects/{gns3_project_id}/nodes")
        
        target_nodes = [n for n in nodes_data if n.get("name") in node_names]
        if len(target_nodes) != 2:
            found = [n.get("name") for n in target_nodes]
            return {"error": f"Could not locate all nodes in topology. Found: {found}"}

        # Generate drawing payloads and route them through the standard drawing function
        drawings = _generate_area_payloads(target_nodes[0], target_nodes[1], area_name, shape_type)
        
        return create_gns3_drawings(ctx, drawings)

    except Exception as e:
        return {"error": f"Failed to process area annotation: {str(e)}"}