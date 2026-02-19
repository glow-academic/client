"""ReplacementViewItem view function (migrated from views/simulation/replacements)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/replacements/get_simulation_replacements_view_complete.sql"


class ReplacementViewItem(BaseModel):
    """A single replacements view item."""

    replacement_id: UUID
    improvement_id: UUID | None = None
    section: str | None = None
    replace_text: str | None = None
    idx: int | None = None
    created_at: datetime | None = None


async def get_attempt_replacement_internal(
    conn: asyncpg.Connection,
    improvement_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[ReplacementViewItem]:
    """Internal function for fetching replacements data."""
    from app.sql.types import GetSimulationReplacementsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_replacement/view",
        {
            "improvement_ids": [str(x) for x in improvement_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                ReplacementViewItem.model_validate(item) for item in cached["items"]
            ]

    params = GetSimulationReplacementsViewSqlParams(
        improvement_ids_filter=improvement_ids
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ReplacementViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ReplacementViewItem(
                    replacement_id=item.replacement_id,
                    improvement_id=item.improvement_id,
                    section=item.section,
                    replace_text=item.replace_text,
                    idx=item.idx,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_replacement"],
    )
    return items
