"""Debug info CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.debug_info.types import CreateDebugInfoResponse


async def create_debug_info(
    conn: asyncpg.Connection,
    call_id: UUID,
    content: str,
    run_id: UUID | None = None,
    mcp: bool = False,
) -> CreateDebugInfoResponse:
    """Create a debug_info entry."""
    debug_info_id = await conn.fetchval(
        """
        INSERT INTO debug_info_entry (call_id, content, run_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        call_id,
        content,
        run_id,
        mcp,
    )

    if debug_info_id is None:
        raise ValueError("Failed to create debug_info entry")

    return CreateDebugInfoResponse(id=debug_info_id)
