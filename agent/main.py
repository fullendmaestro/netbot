import os
import asyncio
from dotenv import load_dotenv
from google.antigravity import Agent, LocalAgentConfig

load_dotenv()

async def main():
    project = os.getenv("GCP_PROJECT_ID")
    location = os.getenv("GCP_LOCATION", "us-central1")
    model_name = os.getenv("ANTIGRAVITY_MODEL", "gemini-2.5-flash")

    config = LocalAgentConfig(
        vertex=True,
        project=project,
        location=location,
        model=model_name
    ) 
    
    async with Agent(config) as agent:
        response = await agent.chat("What files are in the current directory?")
        print(await response.text())

if __name__ == "__main__":
    asyncio.run(main())
