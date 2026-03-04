"""Activity CREATE — insert into activity_entry with profile link."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.activity.types import CreateActivityResponse


async def create_activity(
    conn: asyncpg.Connection,
    session_id: UUID,
    profile_id: UUID | None = None,
    mcp: bool = False,
) -> CreateActivityResponse:
    """Create an activity entry and optionally link to a profile."""
    activity_id = await conn.fetchval(
        """
        INSERT INTO activity_entry (session_id, mcp, generated)
        VALUES ($1, $2, true)
        RETURNING id
        """,
        session_id,
        mcp,
    )

    if activity_id is None:
        raise ValueError("Failed to create activity entry")

    if profile_id is not None:
        await conn.execute(
            """
            INSERT INTO profiles_activity_connection (profiles_id, activity_id)
            VALUES ($1, $2)
            """,
            profile_id,
            activity_id,
        )

    return CreateActivityResponse(id=activity_id)
