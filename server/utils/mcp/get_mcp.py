"""FastAPI dependency to extract mcp flag from X-MCP header.

This dependency is applied at the router level to automatically parse
the X-MCP header for all v4 endpoints. It stores the mcp flag
in request.state for easy access.

Similar to get_profile_id, this dependency reads the header and stores
it in request.state.mcp as a boolean value.
"""

from fastapi import Header, Request


async def get_mcp(
    request: Request,
    x_mcp: str | None = Header(default=None, alias="X-MCP"),
) -> bool:
    """Extract mcp flag from X-MCP header.

    This dependency:
    1. Gets mcp flag from X-MCP header (primary source)
    2. Parses as boolean (treats "true", "1", "yes" as True, else False)
    3. Stores result in request.state.mcp for easy access
    4. Returns False if not found (defaults to False)

    Args:
        request: FastAPI Request object
        x_mcp: X-MCP header value (parsed by FastAPI)

    Returns:
        Boolean value indicating if request is from MCP server
    """
    # Parse header value as boolean
    # Treat "true", "1", "yes" (case-insensitive) as True, else False
    mcp_value: bool = False
    if x_mcp:
        mcp_lower = x_mcp.lower().strip()
        mcp_value = mcp_lower in ("true", "1", "yes")

    # Store in request.state for easy access
    request.state.mcp = mcp_value

    return mcp_value
