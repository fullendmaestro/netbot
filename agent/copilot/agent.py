from google.adk.agents.llm_agent import Agent
from .tools import list_managed_devices, execute_multiple_commands, execute_command, execute_config_commands
from .prompts import NETBOT_SYSTEM_PROMPT

root_agent = Agent(
    model="gemini-2.5-flash",
    name="netbot_copilot",
    description="An expert network engineering copilot capable of high-speed topology inspection and configuration.",
    instruction=NETBOT_SYSTEM_PROMPT,
    tools=[
        list_managed_devices, 
        execute_command,
        execute_multiple_commands,
        execute_config_commands
    ],
)