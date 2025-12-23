"""FastAPI dependency to extract effective_profile_id from X-Effective-Profile-Id header.

This dependency is applied at the router level to automatically parse
the X-Effective-Profile-Id header for all v3 endpoints. It stores the effective_profile_id
in request.state for easy access.

Note: Falls back to X-Profile-Id if X-Effective-Profile-Id is not provided.
"""

from fastapi import Header, Request


async def get_effective_profile_id(
    request: Request,
    x_effective_profile_id: str | None = Header(
        default=None, alias="X-Effective-Profile-Id"
    ),
    x_profile_id: str | None = Header(default=None, alias="X-Profile-Id"),
) -> str | None:
    """Extract effective_profile_id from X-Effective-Profile-Id header.

    This dependency:
    1. Gets effective_profile_id from X-Effective-Profile-Id header (primary source)
    2. Falls back to X-Profile-Id if X-Effective-Profile-Id is not provided
    3. Stores result in request.state.effective_profile_id for easy access
    4. Returns None if not found (endpoints handle validation)

    Args:
        request: FastAPI Request object
        x_effective_profile_id: X-Effective-Profile-Id header value (parsed by FastAPI)
        x_profile_id: X-Profile-Id header value (fallback)

    Returns:
        Effective Profile ID string or None if not found
    """
    effective_profile_id: str | None = x_effective_profile_id

    # Fallback to X-Profile-Id if X-Effective-Profile-Id is not provided
    if not effective_profile_id:
        effective_profile_id = x_profile_id

    # Store in request.state for easy access
    request.state.effective_profile_id = effective_profile_id

    return effective_profile_id
