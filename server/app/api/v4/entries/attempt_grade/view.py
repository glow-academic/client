"""GradeViewItem view function (migrated from views/simulation/grades)."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/simulation/grades/get_simulation_grades_view_complete.sql"
)


class GradeViewItem(BaseModel):
    """A single grades view item."""

    grade_id: UUID
    chat_id: UUID | None = None
    score: float | None = None
    passed: bool | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None
    rubric_id: UUID | None = None
    created_at: datetime | None = None


async def get_attempt_grade_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GradeViewItem]:
    """Internal function for fetching grades data."""
    from app.sql.types import GetSimulationGradesViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_grade/view",
        {
            "chat_ids": [str(x) for x in chat_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [GradeViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationGradesViewSqlParams(chat_ids_filter=chat_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[GradeViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                GradeViewItem(
                    grade_id=item.grade_id,
                    chat_id=item.chat_id,
                    score=float(item.score) if item.score is not None else None,
                    passed=item.passed,
                    time_taken=item.time_taken,
                    total_points=item.total_points,
                    pass_points=item.pass_points,
                    rubric_id=item.rubric_id,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_grade"],
    )
    return items
