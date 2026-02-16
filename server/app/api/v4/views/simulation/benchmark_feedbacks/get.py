"""Get endpoint for simulation benchmark_feedbacks view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.benchmark_feedbacks.types import (
    BenchmarkFeedbackViewItem,
    GetBenchmarkFeedbacksRequest,
    GetBenchmarkFeedbacksResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/benchmark_feedbacks/get_simulation_benchmark_feedbacks_view_complete.sql"

router = APIRouter()


async def get_benchmark_feedbacks_internal(
    conn: asyncpg.Connection,
    grade_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[BenchmarkFeedbackViewItem]:
    """Internal function for fetching benchmark feedbacks data."""
    from app.sql.types import GetBenchmarkFeedbacksViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/benchmark_feedbacks/get",
        {"grade_ids": [str(g) for g in grade_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                BenchmarkFeedbackViewItem.model_validate(item)
                for item in cached["items"]
            ]

    params = GetBenchmarkFeedbacksViewSqlParams(grade_ids_filter=grade_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[BenchmarkFeedbackViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                BenchmarkFeedbackViewItem(
                    feedback_id=item.feedback_id,
                    grade_id=item.grade_id,
                    total=item.total,
                    feedback=item.feedback,
                    total_points=item.total_points,
                    pass_points=item.pass_points,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "benchmark_feedbacks"],
    )
    return items


@router.post(
    "/get",
    response_model=GetBenchmarkFeedbacksResponse,
    dependencies=[
        audit_activity(
            "views.simulation.benchmark_feedbacks.get",
            "{{ actor.name }} fetched simulation benchmark_feedbacks data",
        )
    ],
)
async def get_benchmark_feedbacks(
    request: GetBenchmarkFeedbacksRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkFeedbacksResponse:
    tags = ["views", "simulation", "benchmark_feedbacks"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_benchmark_feedbacks_internal(
            conn=conn,
            grade_ids=request.grade_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetBenchmarkFeedbacksResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_simulation_benchmark_feedbacks_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
