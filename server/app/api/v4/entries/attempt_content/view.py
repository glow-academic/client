"""ContentViewItem view function (migrated from views/simulation/contents)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/simulation/contents/get_attempt_content_view_complete.sql"
)


class ContentViewItem(BaseModel):
    """A single contents view item."""

    content_id: UUID
    message_id: UUID | None = None
    content: str | None = None
    persona_id: UUID | None = None
    idx: int | None = None
    created_at: datetime | None = None


async def get_attempt_content_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[ContentViewItem]:
    """Internal function for fetching contents data."""
    from app.sql.types import GetSimulationContentsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_content/view",
        {
            "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ContentViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationContentsViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ContentViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ContentViewItem(
                    content_id=item.content_id,
                    message_id=item.message_id,
                    content=item.content,
                    persona_id=item.persona_id,
                    idx=item.idx,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_content"],
    )
    return items
