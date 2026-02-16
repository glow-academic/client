"""Get endpoint for benchmark invocations view (lean — no composites)."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.benchmark.invocations.types import (
    BenchmarkInvocationViewItem,
    GetBenchmarkInvocationsRequest,
    GetBenchmarkInvocationsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/benchmark/invocations/get_benchmark_invocations_view_complete.sql"

router = APIRouter()


async def get_benchmark_invocations_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    invocation_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[BenchmarkInvocationViewItem]:
    """Internal function for reading lean benchmark invocation rows.

    Lean: entry attrs + resource IDs + grade scalars only. Feedbacks
    fetched via simulation/benchmark_feedbacks view.
    """
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
                    benchmark_bundle_department_id=item.benchmark_bundle_department_id,
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


@router.post(
    "/get",
    response_model=GetBenchmarkInvocationsResponse,
    dependencies=[
        audit_activity(
            "views.benchmark.invocations.get",
            "{{ actor.name }} fetched benchmark invocations view data",
        )
    ],
)
async def get_benchmark_invocations(
    request: GetBenchmarkInvocationsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkInvocationsResponse:
    """Get benchmark invocation rows from mv_benchmark_invocations."""
    tags = ["views", "benchmark", "invocations"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        requested_ids = request.invocation_ids or request.chat_ids
        items = await get_benchmark_invocations_internal(
            conn=conn,
            test_id=request.test_id,
            invocation_ids=requested_ids,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetBenchmarkInvocationsResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_benchmark_invocations_get",
            request=http_request,
        )
