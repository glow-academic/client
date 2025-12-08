"""Create a function tool for generating images from prompts."""

import uuid
from typing import Any

from agents import Tool, function_tool
from app.main import get_image_generation_storage
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key
from pydantic import Field

logger = get_logger(__name__)


def create_image_generation_function(
    group_id: uuid.UUID | None,
    profile_id: str,
    trace_id: str | None = None,
) -> Tool:
    """Create a function tool for generating images from prompts.
    
    Args:
        group_id: Group ID for the generation operation
        profile_id: Profile ID for tenant isolation
        trace_id: Trace ID for request identification (uses group_id if not provided)
    """
    # Determine primary_id for storage key
    primary_id = trace_id or str(group_id) if group_id else str(uuid.uuid4())
    
    async def generate_image(
        name: str = Field(description="Descriptive name for the generated image"),
        prompt: str = Field(description="Detailed, descriptive prompt for image generation"),
    ) -> str:
        """Generate an image from a detailed prompt.

        This tool creates an image using AI image generation based on your detailed prompt.
        The image will be saved and linked to the scenario after generation completes.

        Args:
            name: Descriptive name for the image (required)
            prompt: Detailed, descriptive prompt describing what the image should look like (required)

        Returns:
            Confirmation message
        """
        # Get storage instance
        storage = get_image_generation_storage()
        
        # Build storage key
        storage_key = build_storage_key(
            operation_type="image_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )
        
        # Get context from storage
        agent_id = await storage.get(storage_key, "agent_id")
        department_id = await storage.get(storage_key, "department_id")
        context_profile_id = await storage.get(storage_key, "profile_id")

        if not agent_id:
            return "Error: Image generation context not set. Cannot generate image."

        # Get existing images list or create new one
        images = await storage.get(storage_key, "images")
        if not images:
            images = []
        
        # Append new image request
        images.append({
            "name": name,
            "prompt": prompt,
            "agent_id": agent_id,
            "department_id": department_id,
            "profile_id": context_profile_id,
        })
        
        # Store updated images list
        await storage.set(storage_key, "images", images)

        logger.info(
            f"✓ Queued image generation: name={name}, "
            f"prompt_length={len(prompt)}"
        )
        return f"Queued image generation for '{name}'. Image will be created after scenario generation completes."

    return function_tool(generate_image)


async def set_image_generation_context(
    agent_id: str,
    profile_id: str,
    primary_id: str,
    department_id: str | None = None,
) -> None:
    """Set the context for image generation tool.
    
    Args:
        agent_id: Agent ID for image generation
        profile_id: Profile ID for tenant isolation (required)
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
        department_id: Optional department ID
    """
    from app.main import get_image_generation_storage
    from app.utils.storage.request_storage import build_storage_key
    
    storage = get_image_generation_storage()
    storage_key = build_storage_key(
        operation_type="image_generation",
        profile_id=profile_id,
        primary_id=primary_id,
    )
    
    # Clear existing context and set new values
    await storage.clear(storage_key)
    await storage.set(storage_key, "agent_id", agent_id)
    if department_id:
        await storage.set(storage_key, "department_id", department_id)
    await storage.set(storage_key, "profile_id", profile_id)


async def get_image_generation_results(
    profile_id: str,
    primary_id: str,
) -> dict[str, Any]:
    """Get image generation results for a request.
    
    Args:
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
        
    Returns:
        Dictionary with image generation results (empty dict if none)
    """
    from app.main import get_image_generation_storage
    from app.utils.storage.request_storage import build_storage_key
    
    storage = get_image_generation_storage()
    storage_key = build_storage_key(
        operation_type="image_generation",
        profile_id=profile_id,
        primary_id=primary_id,
    )
    
    images = await storage.get(storage_key, "images")
    return {"images": images} if images else {}


async def clear_image_generation_results(
    profile_id: str,
    primary_id: str,
) -> None:
    """Clear image generation results for a request.
    
    Args:
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
    """
    from app.main import get_image_generation_storage
    from app.utils.storage.request_storage import build_storage_key
    
    storage = get_image_generation_storage()
    storage_key = build_storage_key(
        operation_type="image_generation",
        profile_id=profile_id,
        primary_id=primary_id,
    )
    
    await storage.delete(storage_key, "images")

