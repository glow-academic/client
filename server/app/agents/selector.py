import logging
from typing import AsyncGenerator, Dict, Callable

from app.agents.aggressive import run_aggressive_agent
from app.agents.confused import run_confused_agent
from app.agents.happy import run_happy_agent
from app.utils.gemini_client import generate_text_non_stream_async # Import for non-streaming

logger = logging.getLogger(__name__)

AGENT_RUNNERS: Dict[str, Callable[[str, str], AsyncGenerator[str, None]]] = {
    "aggressive": run_aggressive_agent,
    "confused": run_confused_agent,
    "happy": run_happy_agent,
}

async def get_agent_response(profile: str, chat_id: str, input_text: str) -> AsyncGenerator[str, None]:
    """
    Selects and runs the appropriate agent based on the profile.
    Yields the agent's response chunks.
    """
    runner = AGENT_RUNNERS.get(profile)
    if not runner:
        logger.warning(f"Unknown profile '{profile}', defaulting to happy agent.")
        runner = run_happy_agent  # Default to happy agent if profile is unknown
    
    logger.info(f"Using {profile} agent for chat_id: {chat_id} with input: {input_text}")
    async for chunk in runner(chat_id=chat_id, input_text=input_text):
        yield chunk

async def generate_scenario(profile: str, chat_id: str) -> str:
    """
    Generates a scenario description based on the profile using Gemini API.
    """
    scenario_prompt_map = {
        "aggressive": "Generate a brief (1-2 sentence) customer service scenario description where the user will interact with a very aggressive and impatient agent. The scenario should set the stage for a challenging interaction.",
        "confused": "Generate a brief (1-2 sentence) customer service scenario description where the user will interact with a very confused agent who misunderstands things easily. The scenario should hint at the need for patience and clear communication.",
        "happy": "Generate a brief (1-2 sentence) customer service scenario description where the user will interact with an overly happy and enthusiastic agent. The scenario should be light-hearted.",
    }
    
    prompt_instruction = scenario_prompt_map.get(profile, f"Generate a brief (1-2 sentence) customer service scenario for an agent with a '{profile}' personality.")
    
    # Use the non-streaming version for scenario generation as it's a single block of text.
    description = await generate_text_non_stream_async(prompt_parts=[prompt_instruction])
    
    if description.startswith("Error:"):
        logger.error(f"Failed to generate scenario from Gemini: {description}")
        # Fallback to a simpler description
        return f"You are about to interact with an agent who has a '{profile}' personality. Prepare for an interesting conversation! (Chat ID: {chat_id})"
        
    logger.info(f"Generated scenario for profile {profile} (chat_id: {chat_id}): {description}")
    return description
