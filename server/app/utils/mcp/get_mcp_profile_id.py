"""MCP helper to get profile_id from request context."""

from fastapi import HTTPException
from fastmcp.server.dependencies import get_http_request

from app.utils.logging.db_logger import profile_id_context


def get_mcp_profile_id() -> str:
    """Get profile_id from MCP request context.
    
    Uses FastMCP Context system to access HTTP request,
    then reads profile_id from request.state.profile_id
    (set by OAuth middleware).
    
    Returns:
        Profile ID UUID string
        
    Raises:
        HTTPException: If profile_id not available
    """
    try:
        request = get_http_request()
    except Exception:
        request = None
    
    if not request:
        profile_id = profile_id_context.get(None)
        if profile_id:
            return profile_id
        raise HTTPException(
            status_code=500,
            detail="MCP request context not available",
        )
    
    profile_id = getattr(request.state, "profile_id", None)
    if not profile_id:
        raise HTTPException(
            status_code=401,
            detail="Profile ID not found. Authentication required.",
        )
    
    return profile_id
