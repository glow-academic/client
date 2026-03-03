"""FastAPI dependency to extract session_id from X-Session-Id header."""

from fastapi import Header, Request


async def get_session_id(
    request: Request,
    x_session_id: str | None = Header(default=None, alias="X-Session-Id"),
) -> str | None:
    """Extract session_id from X-Session-Id header.

    Stores result in request.state.session_id for easy access.
    """
    session_id: str | None = x_session_id
    request.state.session_id = session_id
    return session_id
