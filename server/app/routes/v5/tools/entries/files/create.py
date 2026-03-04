"""Files CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.files.types import CreateFileResponse


async def create_file(
    conn: asyncpg.Connection,
    session_id: UUID,
    mcp: bool = False,
) -> CreateFileResponse:
    """Create a files entry."""
    file_id = await conn.fetchval(
        """
        INSERT INTO files_entry (session_id, mcp, generated)
        VALUES ($1, $2, true)
        RETURNING id
    """,
        session_id,
        mcp,
    )

    if file_id is None:
        raise ValueError("Failed to create files entry")

    return CreateFileResponse(id=file_id)
