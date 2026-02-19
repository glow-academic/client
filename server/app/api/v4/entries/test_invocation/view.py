"""View wrapper for benchmark invocations entries."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/benchmark/invocations/get_test_invocation_view_complete.sql"


class BenchmarkInvocationViewItem(BaseModel):
    """Single benchmark invocation row from test_invocation_mv."""

    invocation_id: UUID
    test_id: UUID
    group_id: UUID | None = None
    suite_department_id: UUID | None = None
    created_at: datetime | None = None
    title: str | None = None
    invocation_completed: bool = False
    grade_score: int | None = None
    grade_passed: bool | None = None
    grade_time_taken: int | None = None
    rubric_id: UUID | None = None
    grade_id: UUID | None = None
    invocation_run_ids: list[UUID] = Field(default_factory=list)
    run_ids: list[UUID] = Field(default_factory=list)
    group_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    model_id: UUID | None = None
    prompt_id: UUID | None = None
    voice_id: UUID | None = None
    temperature_level_id: UUID | None = None
    reasoning_level_id: UUID | None = None
    key_id: UUID | None = None
    historical_run_ids: list[UUID] = Field(default_factory=list)


async def get_test_invocation_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    invocation_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[BenchmarkInvocationViewItem]:
    """Internal function for reading lean benchmark invocation rows."""
    from app.sql.types import GetBenchmarkInvocationsViewSqlParams

    normalized_invocation_ids = invocation_ids or []
    cache_key_val = cache_key(
        "views/benchmark/invocations/get",
        {
            "test_id": str(test_id) if test_id else None,
            "invocation_ids": [str(i) for i in normalized_invocation_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                BenchmarkInvocationViewItem.model_validate(item)
                for item in cached["items"]
            ]

    params = GetBenchmarkInvocationsViewSqlParams(
        test_id_filter=test_id,
        invocation_ids_filter=normalized_invocation_ids or None,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[BenchmarkInvocationViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                BenchmarkInvocationViewItem(
                    invocation_id=item.invocation_id,
                    test_id=item.test_id,
                    group_id=item.group_id,
                    suite_department_id=item.suite_department_id,
                    created_at=item.created_at,
                    title=item.title,
                    invocation_completed=item.invocation_completed or False,
                    grade_score=item.grade_score,
                    grade_passed=item.grade_passed,
                    grade_time_taken=item.grade_time_taken,
                    rubric_id=item.rubric_id,
                    grade_id=item.grade_id,
                    invocation_run_ids=list(item.invocation_run_ids)
                    if item.invocation_run_ids
                    else [],
                    run_ids=list(item.run_ids) if item.run_ids else [],
                    group_ids=list(item.group_ids) if item.group_ids else [],
                    instruction_ids=list(item.instruction_ids)
                    if item.instruction_ids
                    else [],
                    tool_ids=list(item.tool_ids) if item.tool_ids else [],
                    model_id=item.model_id,
                    prompt_id=item.prompt_id,
                    voice_id=item.voice_id,
                    temperature_level_id=item.temperature_level_id,
                    reasoning_level_id=item.reasoning_level_id,
                    key_id=item.key_id,
                    historical_run_ids=list(item.historical_run_ids)
                    if item.historical_run_ids
                    else [],
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "benchmark", "invocations"],
    )

    return items
