from google.adk.agents.llm_agent import Agent
from .tools.nodes import create_gns3_nodes
from .tools.links import create_gns3_links
from .tools.drawings import create_gns3_drawings, create_gns3_area_drawing
from .tools.topology import get_gns3_topology, get_gns3_templates
from .prompts import GNS3_SYSTEM_PROMPT

root_agent = Agent(
    model='gemini-2.5-flash',
    name='gns3_root_agent',
    description='An expert network engineering assistant capable of managing GNS3 projects, nodes, links, and topology drawings.',
    instruction=GNS3_SYSTEM_PROMPT,
    tools=[
        get_gns3_topology,
        get_gns3_templates,
        create_gns3_nodes,
        create_gns3_links,
        create_gns3_drawings,
        create_gns3_area_drawing
    ],
)