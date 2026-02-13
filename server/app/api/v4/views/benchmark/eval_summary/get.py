"""Get endpoint for benchmark eval summary view (mv_benchmark_eval_summary)."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.benchmark.eval_summary.types import (
    BenchmarkEvalSummaryItem,
    GetBenchmarkEvalSummaryRequest,
    GetBenchmarkEvalSummaryResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_benchmark_eval_summary_internal(
    conn: asyncpg.Connection,
    rubric_id: UUID | None = None,
    status: str | None = None,
    department_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetBenchmarkEvalSummaryResponse:
    """Internal function for fetching benchmark eval summary data."""
    cache_key_val = cache_key(
        "views/benchmark/eval_summary/get",
        {
            "rubric_id": str(rubric_id) if rubric_id else None,
            "status": status,
            "department_ids": [str(d) for d in department_ids]
            if department_ids
            else None,
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
            return GetBenchmarkEvalSummaryResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if rubric_id:
        conditions.append(f"rubric_id = ${param_idx}")
        params.append(rubric_id)
        param_idx += 1

    if status:
        conditions.append(f"status = ${param_idx}")
        params.append(status)
        param_idx += 1

    if department_ids:
        conditions.append(
            f"(department_ids && ${param_idx}::uuid[] OR department_ids = '{{}}')"
        )
        params.append(department_ids)
        param_idx += 1

    if date_from:
        conditions.append(f"created_at >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"created_at < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    sort_column = {
        "date": "created_at",
        "status": "status",
        "runs": "total_runs",
    }.get(sort_by, "created_at")

    order_dir = "DESC" if sort_order == "desc" else "ASC"

    count_query = f"SELECT COUNT(*) FROM mv_benchmark_eval_summary WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_benchmark_eval_summary
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        BenchmarkEvalSummaryItem(
            eval_id=row["eval_id"],
            rubric_id=row["rubric_id"],
            agent_ids=row["agent_ids"],
            department_ids=row["department_ids"],
            eval_name_id=row["eval_name_id"],
            eval_description_id=row["eval_description_id"],
            agent_name_ids=row["agent_name_ids"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            use_groups=row["use_groups"] or False,
            dynamic=row["dynamic"] or False,
            total_runs=row["total_runs"] or 0,
            completed_runs=row["completed_runs"] or 0,
            pending_runs=row["pending_runs"] or 0,
            status=row["status"] or "pending",
        )
        for row in rows
    ]

    response = GetBenchmarkEvalSummaryResponse(
        items=items, total_count=total_count or 0
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "benchmark", "eval_summary"],
    )

    return response


@router.post(
    "/get",
    response_model=GetBenchmarkEvalSummaryResponse,
    dependencies=[
        audit_activity(
            "views.benchmark.eval_summary.get",
            "{{ actor.name }} fetched benchmark eval summary data",
        )
    ],
)
async def get_benchmark_eval_summary(
    request: GetBenchmarkEvalSummaryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkEvalSummaryResponse:
    """Get benchmark eval summary data from mv_benchmark_eval_summary."""
    tags = ["views", "benchmark", "eval_summary"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_benchmark_eval_summary_internal(
            conn=conn,
            rubric_id=request.rubric_id,
            status=request.status,
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
            operation="views_benchmark_eval_summary_get",
            request=http_request,
        )
