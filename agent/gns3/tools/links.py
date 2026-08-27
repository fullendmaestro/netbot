from typing import Any
from google.adk.tools.tool_context import ToolContext as Context
from .client import get_gns3_project_details, gns3_request

def create_gns3_links(ctx: Context, links: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Creates one or more links between nodes in the active GNS3 project.
    
    Args:
        ctx: The ADK ToolContext (injected automatically).
        links: A list of link definitions, each containing:
               - node_id1 (str): UUID of the first node.
               - port1 (str): Port name of the first node (e.g., 'Ethernet0/0').
               - node_id2 (str): UUID of the second node.
               - port2 (str): Port name of the second node (e.g., 'Ethernet0/0').
    
    Returns:
        A list of dictionaries containing created link details or error messages.
    """
    try:
        gns3_project_id, server_url = get_gns3_project_details(ctx)
    except Exception as e:
        return [{"error": str(e)}]

    if not links or not isinstance(links, list):
        return [{"error": "Invalid links data: must be a non-empty array"}]

    created_links = []

    for i, link_data in enumerate(links):
        try:
            node_id1 = link_data.get("node_id1")
            port1 = link_data.get("port1")
            node_id2 = link_data.get("node_id2")
            port2 = link_data.get("port2")

            if not all([node_id1, port1, node_id2, port2]):
                created_links.append({"error": f"Missing required fields in link definition {i}"})
                continue

            # Fetch node details to resolve port names to adapter_number/port_number
            node1 = gns3_request(server_url, f"/projects/{gns3_project_id}/nodes/{node_id1}")
            node2 = gns3_request(server_url, f"/projects/{gns3_project_id}/nodes/{node_id2}")

            # Find specific ports
            port1_info = next((p for p in node1.get("ports", []) if p.get("name") == port1), None)
            port2_info = next((p for p in node2.get("ports", []) if p.get("name") == port2), None)

            if not port1_info or not port2_info:
                created_links.append({"error": f"Port not found in link {i}"})
                continue

            # Construct the link payload
            payload = {
                "nodes": [
                    {
                        "node_id": node_id1,
                        "adapter_number": port1_info.get("adapter_number", 0),
                        "port_number": port1_info.get("port_number", 0)
                    },
                    {
                        "node_id": node_id2,
                        "adapter_number": port2_info.get("adapter_number", 0),
                        "port_number": port2_info.get("port_number", 0)
                    }
                ]
            }

            # Create the link
            link = gns3_request(server_url, f"/projects/{gns3_project_id}/links", method="POST", payload=payload)

            created_links.append({
                "link_id": link.get("link_id"),
                "node_id1": node_id1,
                "port1": port1,
                "node_id2": node_id2,
                "port2": port2
            })

        except Exception as e:
            created_links.append({"error": f"Failed to create link {i}: {str(e)}"})

    return created_links