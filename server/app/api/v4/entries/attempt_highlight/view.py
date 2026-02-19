"""HighlightViewItem view function (migrated from views/simulation/highlights)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/highlights/get_attempt_highlight_view_complete.sql"


class HighlightViewItem(BaseModel):
    """A single highlights view item."""

    highlight_id: UUID
    strength_id: UUID | None = None
    section: str | None = None
    idx: int | None = None
    created_at: datetime | None = None


async def get_attempt_highlight_internal(
    conn: asyncpg.Connection,
    strength_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[HighlightViewItem]:
    """Internal function for fetching highlights data."""
    from app.sql.types import GetSimulationHighlightsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_highlight/view",
        {
        "strength_ids": [str(x) for x in strength_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [HighlightViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationHighlightsViewSqlParams(strength_ids_filter=strength_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[HighlightViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                HighlightViewItem(
                    highlight_id=item.highlight_id,
                    strength_id=item.strength_id,
                    section=item.section,
                    idx=item.idx,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_highlight"],
    )
    return items
