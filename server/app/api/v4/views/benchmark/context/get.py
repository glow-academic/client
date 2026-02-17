"""Get endpoint for benchmark context view."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.benchmark.context.types import (
    BenchmarkContextViewItem,
    GetBenchmarkContextViewResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/benchmark/context/get_benchmark_context_view_complete.sql"
)

router = APIRouter()


async def get_benchmark_context_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetBenchmarkContextViewResponse:
    """Internal function for IDs-first benchmark context data."""
    from app.sql.types import GetBenchmarkContextViewSqlParams

    cache_key_val = cache_key(
        "views/benchmark/context/get",
        {"profile_id": str(profile_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetBenchmarkContextViewResponse.model_validate(cached)

    params = GetBenchmarkContextViewSqlParams(
        profile_id_filter=profile_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[BenchmarkContextViewItem] = []
    if result and result.items:
        for item in result.items:
            if not item.benchmark_id:
                continue
            items.append(
                BenchmarkContextViewItem(
                    benchmark_id=item.benchmark_id,
                    eval_ids=list(item.eval_ids) if item.eval_ids else None,
                    suite_entry_ids=(
                        list(item.suite_entry_ids) if item.suite_entry_ids else None
                    ),
                    department_ids=(
                        list(item.department_ids) if item.department_ids else None
                    ),
                    profile_ids=(list(item.profile_ids) if item.profile_ids else None),
                    run_rubric_ids=(
                        list(item.run_rubric_ids) if item.run_rubric_ids else None
                    ),
                    group_rubric_ids=(
                        list(item.group_rubric_ids) if item.group_rubric_ids else None
                    ),
                    run_position_ids=(
                        list(item.run_position_ids) if item.run_position_ids else None
                    ),
                    group_position_ids=(
                        list(item.group_position_ids)
                        if item.group_position_ids
                        else None
                    ),
                    use_groups=item.use_groups or False,
                    dynamic=item.dynamic or False,
                )
            )

    response = GetBenchmarkContextViewResponse(
        items=items,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "benchmark", "context"],
    )

    return response


@router.post(
    "/get",
    response_model=GetBenchmarkContextViewResponse,
    dependencies=[
        audit_activity(
            "views.benchmark.context.get",
            "{{ actor.name }} fetched benchmark context view",
        )
    ],
)
async def get_benchmark_context_view(
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkContextViewResponse:
    """Get benchmark context view for current profile."""
    tags = ["views", "benchmark", "context"]
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple | None = None

    try:
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required")

        result = await get_benchmark_context_view_internal(
            conn=conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="views_benchmark_context_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
