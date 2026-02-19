"""FeedbackViewItem view function (migrated from views/simulation/feedbacks)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/feedbacks/get_attempt_feedback_view_complete.sql"


class FeedbackViewItem(BaseModel):
    """A single feedbacks view item."""

    feedback_id: UUID
    grade_id: UUID | None = None
    standard_id: UUID | None = None
    total: float | None = None
    feedback: str | None = None
    created_at: datetime | None = None


async def get_attempt_feedback_internal(
    conn: asyncpg.Connection,
    grade_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[FeedbackViewItem]:
    """Internal function for fetching feedbacks data."""
    from app.sql.types import GetSimulationFeedbacksViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_feedback/view",
        {
        "grade_ids": [str(x) for x in grade_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [FeedbackViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationFeedbacksViewSqlParams(grade_ids_filter=grade_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[FeedbackViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                FeedbackViewItem(
                    feedback_id=item.feedback_id,
                    grade_id=item.grade_id,
                    standard_id=item.standard_id,
                    total=float(item.total) if item.total is not None else None,
                    feedback=item.feedback,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_feedback"],
    )
    return items
