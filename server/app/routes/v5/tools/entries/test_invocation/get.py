"""test_invocation/get — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.sql.types import (
    QGetTestInvocationViewV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

from app.routes.v5.tools.entries.test_invocation.types import (
    GetTestInvocationResponse,
)

MV_NAME = "test_invocation_mv"

VIEW_SQL_PATH = (
    "app/sql/queries/views/benchmark/invocations/get_test_invocation_view_complete.sql"
)


async def get_test_invocations(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetTestInvocationResponse]:
    """Fetch test_invocation entries by IDs from the MV."""
    if not ids:
        return []

    rows = await conn.fetch(
        f"""
        SELECT
            invocation_id, test_id, group_id, invocation_created_at,
            invocation_title, use_custom, "position", invocation_completed,
            grade_id, grade_score, grade_passed, grade_time_taken,
            rubric_id, agent_ids, quality_id, department_ids,
            run_agent_ids, group_agent_ids, voice_id,
            temperature_level_id, reasoning_level_id
        FROM {MV_NAME}
        WHERE invocation_id = ANY($1)
        """,
        ids,
    )

    return [
        GetTestInvocationResponse(
            invocation_id=r["invocation_id"],
            test_id=r["test_id"],
            group_id=r["group_id"],
            invocation_created_at=r["invocation_created_at"],
            invocation_title=r["invocation_title"],
            use_custom=r["use_custom"],
            position=r["position"],
            invocation_completed=r["invocation_completed"],
            grade_id=r["grade_id"],
            grade_score=r["grade_score"],
            grade_passed=r["grade_passed"],
            grade_time_taken=r["grade_time_taken"],
            rubric_id=r["rubric_id"],
            agent_ids=r["agent_ids"],
            quality_id=r["quality_id"],
            department_ids=r["department_ids"],
            run_agent_ids=r["run_agent_ids"],
            group_agent_ids=r["group_agent_ids"],
            voice_id=r["voice_id"],
            temperature_level_id=r["temperature_level_id"],
            reasoning_level_id=r["reasoning_level_id"],
        )
        for r in rows
    ]


async def get_test_invocation_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    invocation_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[QGetTestInvocationViewV4Item]:
    """Internal function for reading lean benchmark invocation rows."""
    from app.sql.types import GetTestInvocationViewSqlParams

    normalized_invocation_ids = invocation_ids or []
    cache_key_val = cache_key(
        "views/benchmark/invocations/get",
        {
            "test_id": str(test_id) if test_id else None,
            "invocation_ids": [str(i) for i in normalized_invocation_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return [
                QGetTestInvocationViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetTestInvocationViewSqlParams(
        test_id_filter=test_id,
        invocation_ids_filter=normalized_invocation_ids or None,
    )

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetTestInvocationViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "benchmark", "invocations"],
        redis=get_redis_client(),
    )

    return items
