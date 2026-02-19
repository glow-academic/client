"""SimMessageViewItem view function (migrated from views/simulation/messages)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/simulation/messages/get_attempt_message_view_complete.sql"
)


class SimMessageViewItem(BaseModel):
    """A single messages view item."""

    message_id: UUID
    chat_id: UUID | None = None
    attempt_id: UUID | None = None
    type: str | None = None
    created_at: datetime | None = None
    completed: bool = False
    runs_id: UUID | None = None
    text_id: UUID | None = None
    audio_id: UUID | None = None
    history_content: str | None = None


async def get_attempt_message_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> list[SimMessageViewItem]:
    """Internal function for fetching messages data."""
    from app.sql.types import GetSimulationMessagesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_message/view",
        {
            "attempt_id": str(attempt_id),
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [SimMessageViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationMessagesViewSqlParams(attempt_id_filter=attempt_id)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[SimMessageViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                SimMessageViewItem(
                    message_id=item.message_id,
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    type=item.type,
                    created_at=item.created_at,
                    completed=item.completed or False,
                    runs_id=item.runs_id,
                    text_id=item.text_id,
                    audio_id=item.audio_id,
                    history_content=item.history_content,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_message"],
    )
    return items
