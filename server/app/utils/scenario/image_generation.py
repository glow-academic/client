"""Image generation helpers for scenario generation."""

from typing import Any

from app.main import get_image_generation_storage
from app.utils.storage.request_storage import build_storage_key


async def set_image_generation_context(
    agent_id: str,
    profile_id: str,
    primary_id: str,
    department_id: str | None = None,
    room: str | None = None,
) -> None:
    """Set the context for image generation tool.

    Args:
        agent_id: Agent ID for image generation
        profile_id: Profile ID for tenant isolation (required)
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
        department_id: Optional department ID
        room: WebSocket room/sid for emitting events (optional)
    """
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
    if room:
        await storage.set(storage_key, "room", room)


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
    storage = get_image_generation_storage()
    storage_key = build_storage_key(
        operation_type="image_generation",
        profile_id=profile_id,
        primary_id=primary_id,
    )

    await storage.delete(storage_key, "images")
