"""chat/search — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

MV_NAME = "chat_mv"


async def search_chat_entries_internal(
    conn: asyncpg.Connection,
    parent_ids: list[UUID] | None = None,
    limit_count: int = 20,
    offset_count: int = 0,
) -> list[dict]:
    """Search chat entries from chat_mv."""
    rows = await conn.fetch(
        f"""
        SELECT chat_entry_id, parent_id, scenario_id, name, description,
               department_ids, persona_ids, created_at, active
        FROM {MV_NAME}
        WHERE ($1::uuid[] IS NULL OR parent_id = ANY($1))
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        parent_ids,
        limit_count,
        offset_count,
    )

    return [dict(r) for r in rows]
