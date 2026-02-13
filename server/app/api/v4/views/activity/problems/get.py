"""Get endpoint for activity problems view (mv_activity_problems)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.activity.problems.types import (
    ActivityProblemItem,
    GetActivityProblemsRequest,
    GetActivityProblemsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/activity/problems/get_activity_problems_view_complete.sql"
)

router = APIRouter()


async def get_activity_problems_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    profile_ids: list[UUID] | None = None,
    resolved: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityProblemsResponse:
    """Internal function for fetching activity problems data."""
    from app.sql.types import GetActivityProblemsViewSqlParams

    cache_key_val = cache_key(
        "views/activity/problems/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "profile_ids": [str(p) for p in profile_ids] if profile_ids else None,
            "resolved": resolved,
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
            return GetActivityProblemsResponse.model_validate(cached)

    params = GetActivityProblemsViewSqlParams.model_construct(
        profile_id_filter=profile_id,
        profile_ids_filter=profile_ids,
        resolved_filter=resolved,
        date_from=date_from,
        date_to=date_to,
        sort_desc=sort_order == "desc",
        page_limit=page_limit,
        page_offset=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items = []
    if result and result.items:
        for item in result.items:
            items.append(
                ActivityProblemItem(
                    problem_id=item.problem_id,
                    type=item.type,
                    message=item.message,
                    resolved=item.resolved or False,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    profile_id=item.profile_id,
                    profile_name=item.profile_name,
                )
            )

    total_count = result.total_count if result else 0

    response = GetActivityProblemsResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "problems"],
    )

    return response


@router.post(
    "/get",
    response_model=GetActivityProblemsResponse,
    dependencies=[
        audit_activity(
            "views.activity.problems.get",
            "{{ actor.name }} fetched activity problems data",
        )
    ],
)
async def get_activity_problems(
    request: GetActivityProblemsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivityProblemsResponse:
    """Get activity problems data from mv_activity_problems."""
    tags = ["views", "activity", "problems"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_activity_problems_internal(
            conn=conn,
            profile_id=request.profile_id,
            resolved=request.resolved,
            date_from=request.date_from,
            date_to=request.date_to,
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
            operation="views_activity_problems_get",
            request=http_request,
        )
