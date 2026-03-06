"""Files CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.files.types import CreateFileResponse


async def create_file(
    conn: asyncpg.Connection,
    session_id: UUID,
    files_id: UUID | None = None,
    mcp: bool = False,
) -> CreateFileResponse:
    """Create a files entry with optional link to files resource."""
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

    if files_id is not None:
        await conn.execute(
            """
            INSERT INTO file_files_connection (file_id, files_id, mcp)
            VALUES ($1, $2, $3)
        """,
            file_id,
            files_id,
            mcp,
        )

    return CreateFileResponse(id=file_id)
