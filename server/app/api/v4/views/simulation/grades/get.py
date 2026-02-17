"""Get endpoint for simulation grades view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.grades.types import (
    GetGradesRequest,
    GetGradesResponse,
    GradeViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/simulation/grades/get_attempt_grade_view_complete.sql"
)

router = APIRouter()


async def get_attempt_grade_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[GradeViewItem]:
    """Internal function for fetching grades data."""
    from app.sql.types import GetSimulationGradesViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/grades/get",
        {"chat_ids": [str(c) for c in chat_ids]},
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
                    score=item.score,
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
        tags=["views", "simulation", "grades"],
    )
    return items


@router.post(
    "/get",
    response_model=GetGradesResponse,
    dependencies=[
        audit_activity(
            "views.simulation.grades.get",
            "{{ actor.name }} fetched simulation grades data",
        )
    ],
)
async def get_grades(
    request: GetGradesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGradesResponse:
    tags = ["views", "simulation", "grades"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_attempt_grade_internal(
            conn=conn,
            chat_ids=request.chat_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetGradesResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_grade_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
