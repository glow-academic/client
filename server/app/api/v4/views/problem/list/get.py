"""Get endpoint for problem list view."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.problem.list.types import (
    GetProblemListViewResponse,
    ProblemViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/problem/list/get_problem_list_view_complete.sql"

router = APIRouter()


async def get_problem_list_view_internal(
    conn: asyncpg.Connection,
    profile_id_filter: UUID | None = None,
    resolved_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetProblemListViewResponse:
    """Internal function for fetching problem data from problems_mv."""
    from app.sql.types import GetProblemListViewSqlParams

    cache_key_val = cache_key(
        "views/problem/list/get",
        {
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "resolved_filter": resolved_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetProblemListViewResponse.model_validate(cached)

    params = GetProblemListViewSqlParams(
        profile_id_filter=profile_id_filter,
        resolved_filter=resolved_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ProblemViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ProblemViewItem(
                    problem_id=item.problem_id,
                    type=item.type,
                    message=item.message,
                    resolved=item.resolved,
                    session_id=item.session_id,
                    problem_created_at=item.problem_created_at,
                    problem_updated_at=item.problem_updated_at,
                    profile_id=item.profile_id,
                )
            )

    response = GetProblemListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "problem", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetProblemListViewResponse,
    dependencies=[
        audit_activity(
            "views.problem.list.get",
            "{{ actor.name }} fetched problem list data",
        )
    ],
)
async def get_problems(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProblemListViewResponse:
    """Get problem data from the materialized view."""
    tags = ["views", "problem", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_problem_list_view_internal(
            conn=conn,
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
            operation="views_problem_list_get",
            request=http_request,
        )
