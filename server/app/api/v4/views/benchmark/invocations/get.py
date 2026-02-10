"""Get endpoint for benchmark invocations view (mv_benchmark_invocations)."""

from typing import Annotated, Any
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

router = APIRouter()


async def get_benchmark_invocations_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    invocation_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> list[BenchmarkInvocationViewItem]:
    """Internal function for reading benchmark invocation rows."""
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

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if test_id:
        conditions.append(f"test_id = ${param_idx}")
        params.append(test_id)
        param_idx += 1

    if normalized_invocation_ids:
        conditions.append(f"invocation_id = ANY(${param_idx}::uuid[])")
        params.append(normalized_invocation_ids)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    rows = await conn.fetch(
        f"""
        SELECT *
        FROM mv_benchmark_invocations
        WHERE {where_clause}
        ORDER BY invocation_created_at ASC
        """,
        *params,
    )

    items = [
        BenchmarkInvocationViewItem(
            invocation_id=row["invocation_id"],
            test_id=row["test_id"],
            eval_id=row["eval_id"],
            run_ids=row["run_ids"] or [],
            group_id=row["group_id"],
            invocation_created_at=row["invocation_created_at"],
            invocation_updated_at=row["invocation_updated_at"],
            invocation_title=row["invocation_title"],
            invocation_completed=row["invocation_completed"] or False,
            grade_score=row["grade_score"],
            grade_passed=row["grade_passed"],
            grade_time_taken=row["grade_time_taken"],
            num_messages=row["num_messages"] or 0,
        )
        for row in rows
    ]

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


# Backward-compatible alias for existing internal imports
get_benchmark_chats_internal = get_benchmark_invocations_internal
