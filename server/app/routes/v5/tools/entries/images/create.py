"""Images CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.images.types import CreateImageResponse


async def create_image(
    conn: asyncpg.Connection,
    session_id: UUID,
    mcp: bool = False,
) -> CreateImageResponse:
    """Create an images entry."""
    image_id = await conn.fetchval(
        """
        INSERT INTO images_entry (session_id, mcp, generated)
        VALUES ($1, $2, true)
        RETURNING id
    """,
        session_id,
        mcp,
    )

    if image_id is None:
        raise ValueError("Failed to create images entry")

    return CreateImageResponse(id=image_id)
