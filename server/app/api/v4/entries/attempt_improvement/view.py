"""ImprovementViewItem view function (migrated from views/simulation/improvements)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/improvements/get_attempt_improvement_view_complete.sql"


class ImprovementViewItem(BaseModel):
    """A single improvements view item."""

    improvement_id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    created_at: datetime | None = None


async def get_attempt_improvement_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[ImprovementViewItem]:
    """Internal function for fetching improvements data."""
    from app.sql.types import GetSimulationImprovementsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_improvement/view",
        {
        "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ImprovementViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationImprovementsViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ImprovementViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ImprovementViewItem(
                    improvement_id=item.improvement_id,
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
        tags=["entries", "attempt_improvement"],
    )
    return items
