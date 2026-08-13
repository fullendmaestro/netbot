import os
import asyncio
from google.antigravity import Agent, LocalAgentConfig

async def main():
    config = LocalAgentConfig(
        project="master-inn-505014-t1",
        location="us-central1",
        # Force fallback to an instantly accessible model for your credit tier
        model="gemini-2.5-flash" 
    ) 
    
    async with Agent(config) as agent:
        response = await agent.chat("What files are in the current directory?")
        print(await response.text())

if __name__ == "__main__":
    asyncio.run(main())


# from google import genai
# from google.genai import types
# import base64
# import os

# def generate():
#   client = genai.Client(
#       vertexai=True,
#       api_key=os.environ.get("GOOGLE_CLOUD_API_KEY"),
#   )

#   model = "gemini-3.6-flash"
  
#   # Added a text prompt to the parts list to fix the empty input error
#   contents = [
#     types.Content(
#       role="user",
#       parts=[
#           types.Part.from_text(text="What is the weather like in Tokyo today?")
#       ]
#     )
#   ]
  
#   tools = [
#     types.Tool(google_search=types.GoogleSearch()),
#     types.Tool(google_maps=types.GoogleMaps()),
#   ]
#   tool_config = types.ToolConfig(
#       retrieval_config = types.RetrievalConfig(
#       ),
#   )

#   generate_content_config = types.GenerateContentConfig(
#     max_output_tokens = 65535,
#     safety_settings = [types.SafetySetting(
#       category="HARM_CATEGORY_HATE_SPEECH",
#       threshold="OFF"
#     ),types.SafetySetting(
#       category="HARM_CATEGORY_DANGEROUS_CONTENT",
#       threshold="OFF"
#     ),types.SafetySetting(
#       category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
#       threshold="OFF"
#     ),types.SafetySetting(
#       category="HARM_CATEGORY_HARASSMENT",
#       threshold="OFF"
#     )],
#     tools = tools,
#     tool_config = tool_config,
#     thinking_config=types.ThinkingConfig(
#       thinking_level="MEDIUM",
#     ),
#   )

#   for chunk in client.models.generate_content_stream(
#     model = model,
#     contents = contents,
#     config = generate_content_config,
#     ):
#     if not chunk.candidates or not chunk.candidates[0].content or not chunk.candidates[0].content.parts:
#         continue
#     print(chunk.text, end="")

# generate()