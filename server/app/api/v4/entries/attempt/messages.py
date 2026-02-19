"""Attempt messages entries (migrated from views/attempt/messages)."""

from uuid import UUID

import asyncpg

from app.api.v4.entries.attempt.types import AttemptMessageViewItem
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/attempt/messages/get_attempt_messages_view_complete.sql"
)


async def get_attempt_messages_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> list[AttemptMessageViewItem]:
    """Internal function for fetching lean message data."""
    from app.sql.types import GetAttemptMessagesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt/messages/get",
        {"attempt_id": str(attempt_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                AttemptMessageViewItem.model_validate(item)
                for item in cached["items"]
            ]

    params = GetAttemptMessagesViewSqlParams(attempt_id_filter=attempt_id)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[AttemptMessageViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                AttemptMessageViewItem(
                    message_id=item.message_id,
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    type=item.type,
                    created_at=item.created_at,
                    completed=item.completed or False,
                    runs_id=item.runs_id,
                    history_content=item.history_content,
                    audio_id=item.audio_id,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt", "messages"],
    )

    return items
