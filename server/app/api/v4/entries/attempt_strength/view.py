"""StrengthViewItem view function (migrated from views/simulation/strengths)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/strengths/get_attempt_strength_view_complete.sql"


class StrengthViewItem(BaseModel):
    """A single strengths view item."""

    strength_id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    created_at: datetime | None = None


async def get_attempt_strength_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[StrengthViewItem]:
    """Internal function for fetching strengths data."""
    from app.sql.types import GetSimulationStrengthsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_strength/view",
        {
        "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [StrengthViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationStrengthsViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[StrengthViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                StrengthViewItem(
                    strength_id=item.strength_id,
                    message_id=item.message_id,
                    name=item.name,
                    description=item.description,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_strength"],
    )
    return items
