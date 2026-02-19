"""AnalysisViewItem view function (migrated from views/simulation/analyses)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/analyses/get_simulation_analyses_view_complete.sql"


class AnalysisViewItem(BaseModel):
    """A single analyses view item."""

    analysis_id: UUID
    grade_id: UUID | None = None
    content: str | None = None
    created_at: datetime | None = None


async def get_attempt_analysis_internal(
    conn: asyncpg.Connection,
    grade_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[AnalysisViewItem]:
    """Internal function for fetching analyses data."""
    from app.sql.types import GetSimulationAnalysesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_analysis/view",
        {
            "grade_ids": [str(x) for x in grade_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [AnalysisViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationAnalysesViewSqlParams(grade_ids_filter=grade_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[AnalysisViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                AnalysisViewItem(
                    analysis_id=item.analysis_id,
                    grade_id=item.grade_id,
                    content=item.content,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_analysis"],
    )
    return items
