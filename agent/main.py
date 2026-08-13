import os
import asyncio
from google.antigravity import Agent, LocalAgentConfig

async def main():
    config = LocalAgentConfig(
        vertex=True,
        project="master-inn-505014-t1",
        location="us-central1",
        model="gemini-2.5-flash"
    ) 
    
    async with Agent(config) as agent:
        response = await agent.chat("What files are in the current directory?")
        print(await response.text())

if __name__ == "__main__":
    asyncio.run(main())
