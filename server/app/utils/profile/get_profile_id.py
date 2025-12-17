"""FastAPI dependency to extract profile_id from X-Profile-Id header.

This dependency is applied at the router level to automatically parse
the X-Profile-Id header for all v3 endpoints. It stores the profile_id
in request.state for easy access.

Note: Body extraction for backward compatibility is handled by middleware
(DBLoggingMiddleware) which runs before dependencies. The middleware
checks request.state.profile_id first, then falls back to body/header.
"""

from fastapi import Header, Request


async def get_profile_id(
    request: Request,
    x_profile_id: str | None = Header(default=None, alias="X-Profile-Id"),
) -> str | None:
    """Extract profile_id from X-Profile-Id header.

    This dependency:
    1. Gets profile_id from X-Profile-Id header (primary source)
    2. Stores result in request.state.profile_id for easy access
    3. Returns None if not found (endpoints handle validation)

    Note: Body extraction for backward compatibility is handled by
    DBLoggingMiddleware which runs before dependencies and checks
    request.state.profile_id first.

    Args:
        request: FastAPI Request object
        x_profile_id: X-Profile-Id header value (parsed by FastAPI)

    Returns:
        Profile ID string or None if not found
    """
    profile_id: str | None = x_profile_id

    # Store in request.state for easy access
    request.state.profile_id = profile_id

    return profile_id

