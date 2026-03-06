"""Videos CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.videos.types import CreateVideoResponse


async def create_video(
    conn: asyncpg.Connection,
    session_id: UUID,
    length_seconds: int = 0,
    videos_id: UUID | None = None,
    mcp: bool = False,
) -> CreateVideoResponse:
    """Create a videos entry with optional link to videos resource."""
    video_id = await conn.fetchval(
        """
        INSERT INTO videos_entry (session_id, length_seconds, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """,
        session_id,
        length_seconds,
        mcp,
    )

    if video_id is None:
        raise ValueError("Failed to create videos entry")

    if videos_id is not None:
        await conn.execute(
            """
            INSERT INTO videos_videos_connection (video_id, videos_id, mcp)
            VALUES ($1, $2, $3)
        """,
            video_id,
            videos_id,
            mcp,
        )

    return CreateVideoResponse(id=video_id)
