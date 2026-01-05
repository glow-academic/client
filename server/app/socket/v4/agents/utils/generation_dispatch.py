"""Helper module for determining which generation handler to use based on agent role."""

from typing import Literal

# Mapping from agent role to generation handler type
AGENT_ROLE_TO_GENERATION_TYPE: dict[str, Literal["text", "image", "video", "audio"]] = {
    # Text generation handlers
    "scenario": "text",
    "document": "text",
    "simulation": "text",
    "grade": "text",
    "hint": "text",
    "classify": "text",
    "member": "text",
    "prompt": "text",
    "rubric": "text",
    "title": "text",
    "audio": "text",  # Audio agent outputs text (takes audio input)
    # Image generation handler
    "image": "image",
    # Video generation handler
    "video": "video",
    # Audio generation handler (ephemeral sessions only)
    "voice": "audio",
}


def get_generation_handler(agent_role: str) -> Literal["text", "image", "video", "audio"]:
    """
    Determine which generation handler to use based on agent role.
    
    Args:
        agent_role: The agent role string (e.g., "scenario", "image", "video", "audio", "voice")
        
    Returns:
        The generation handler type: "text", "image", "video", or "audio"
        
    Raises:
        ValueError: If agent_role is not recognized
    """
    generation_type = AGENT_ROLE_TO_GENERATION_TYPE.get(agent_role)
    if generation_type is None:
        raise ValueError(
            f"Unknown agent role: {agent_role}. "
            f"Supported roles: {', '.join(AGENT_ROLE_TO_GENERATION_TYPE.keys())}"
        )
    return generation_type

