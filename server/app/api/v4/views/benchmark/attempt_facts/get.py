"""Get endpoint for benchmark attempt facts view (mv_benchmark_attempt_facts)."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.benchmark.attempt_facts.types import (
    BenchmarkAttemptFactsItem,
    GetBenchmarkAttemptFactsRequest,
    GetBenchmarkAttemptFactsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_benchmark_attempt_facts_internal(
    conn: asyncpg.Connection,
    eval_id: UUID | None = None,
    rubric_id: UUID | None = None,
    status: str | None = None,
    archived: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetBenchmarkAttemptFactsResponse:
    """Internal function for fetching benchmark test facts data."""
    cache_key_val = cache_key(
        "views/benchmark/attempt_facts/get",
        {
            "eval_id": str(eval_id) if eval_id else None,
            "rubric_id": str(rubric_id) if rubric_id else None,
            "status": status,
            "archived": archived,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetBenchmarkAttemptFactsResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if eval_id:
        conditions.append(f"eval_id = ${param_idx}")
        params.append(eval_id)
        param_idx += 1

    if rubric_id:
        conditions.append(f"rubric_id = ${param_idx}")
        params.append(rubric_id)
        param_idx += 1

    if status:
        conditions.append(f"status = ${param_idx}")
        params.append(status)
        param_idx += 1

    if archived is not None:
        conditions.append(f"archived = ${param_idx}")
        params.append(archived)
        param_idx += 1

    if date_from:
        conditions.append(f"attempt_created_at >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"attempt_created_at < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    sort_column = {
        "date": "attempt_created_at",
        "status": "status",
    }.get(sort_by, "attempt_created_at")

    order_dir = "DESC" if sort_order == "desc" else "ASC"

    count_query = (
        f"SELECT COUNT(*) FROM mv_benchmark_attempt_facts WHERE {where_clause}"
    )
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_benchmark_attempt_facts
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        BenchmarkAttemptFactsItem(
            attempt_id=row["attempt_id"],
            eval_id=row["eval_id"],
            rubric_id=row["rubric_id"],
            department_ids=row["department_ids"],
            attempt_created_at=row["attempt_created_at"],
            archived=row["archived"] or False,
            total_runs=row["total_runs"] or 0,
            completed_runs=row["completed_runs"] or 0,
            pending_runs=row["pending_runs"] or 0,
            status=row["status"] or "pending",
        )
        for row in rows
    ]

    response = GetBenchmarkAttemptFactsResponse(
        items=items, total_count=total_count or 0
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "benchmark", "attempt_facts"],
    )

    return response


@router.post(
    "/get",
    response_model=GetBenchmarkAttemptFactsResponse,
    dependencies=[
        audit_activity(
            "views.benchmark.attempt_facts.get",
            "{{ actor.name }} fetched benchmark attempt facts data",
        )
    ],
)
async def get_benchmark_attempt_facts(
    request: GetBenchmarkAttemptFactsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkAttemptFactsResponse:
    """Get benchmark attempt facts data from mv_benchmark_attempt_facts."""
    tags = ["views", "benchmark", "attempt_facts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_benchmark_attempt_facts_internal(
            conn=conn,
            eval_id=request.eval_id,
            rubric_id=request.rubric_id,
            status=request.status,
            archived=request.archived,
            date_from=request.date_from,
            date_to=request.date_to,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_benchmark_attempt_facts_get",
            request=http_request,
        )
