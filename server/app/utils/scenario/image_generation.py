"""Image generation helpers for scenario generation.

Note: Image generation context is now passed directly via function parameters
instead of using storage. Background tasks receive context as parameters.
"""

from typing import Any


def _build_storage_key(
    operation_type: str,
    profile_id: str | None,
    primary_id: str | None,
) -> str:
    """Build a storage key for image generation context.
    
    Args:
        operation_type: Type of operation (e.g., "image_generation")
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID (trace_id, scenario_id, etc.)
    
    Returns:
        Storage key string
    """
    profile_part = profile_id if profile_id else ""
    primary_part = primary_id if primary_id else ""
    return f"{operation_type}:{profile_part}:{primary_part}"


async def set_image_generation_context(
    agent_id: str,
    profile_id: str,
    primary_id: str,
    department_id: str | None = None,
    room: str | None = None,
) -> None:
    """Set the context for image generation tool.
    
    Note: This function is now a no-op. Image generation context is passed
    directly to background tasks via function parameters instead of storage.

    Args:
        agent_id: Agent ID for image generation
        profile_id: Profile ID for tenant isolation (required)
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
        department_id: Optional department ID
        room: WebSocket room/sid for emitting events (optional)
    """
    # No-op: Image generation context is now passed directly to background tasks
    pass


async def get_image_generation_results(
    profile_id: str,
    primary_id: str,
) -> dict[str, Any]:
    """Get image generation results for a request.
    
    Note: This function now returns empty results. Image IDs are retrieved
    from the database after images are created, not from storage.

    Args:
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)

    Returns:
        Dictionary with image generation results (empty dict - images retrieved from DB)
    """
    # Return empty - images are retrieved from database after creation
    return {}


async def clear_image_generation_results(
    profile_id: str,
    primary_id: str,
) -> None:
    """Clear image generation results for a request.
    
    Note: This function is now a no-op. Image generation results are stored
    in the database, not in storage.

    Args:
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
    """
    # No-op: Image generation results are stored in database, not storage
    pass
