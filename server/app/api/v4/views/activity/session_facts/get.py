"""Get endpoint for activity session facts view (mv_activity_session_facts)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.activity.session_facts.types import (
    ActivitySessionFactsItem,
    GetActivitySessionFactsRequest,
    GetActivitySessionFactsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/activity/session_facts/get_activity_session_facts_view_complete.sql"

router = APIRouter()


async def get_activity_session_facts_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    profile_ids: list[UUID] | None = None,
    active: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivitySessionFactsResponse:
    """Internal function for fetching activity session facts data."""
    from app.sql.types import GetActivitySessionFactsViewSqlParams

    cache_key_val = cache_key(
        "views/activity/session_facts/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "profile_ids": [str(p) for p in profile_ids] if profile_ids else None,
            "active": active,
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
            return GetActivitySessionFactsResponse.model_validate(cached)

    params = GetActivitySessionFactsViewSqlParams.model_construct(
        profile_id_filter=profile_id,
        profile_ids_filter=profile_ids,
        active_filter=active,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_desc=sort_order == "desc",
        page_limit=page_limit,
        page_offset=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items = []
    if result and result.items:
        for item in result.items:
            items.append(
                ActivitySessionFactsItem(
                    session_id=item.session_id,
                    profile_id=item.profile_id,
                    session_created_at=item.session_created_at,
                    session_updated_at=item.session_updated_at,
                    active=item.active or False,
                    group_count=item.group_count or 0,
                    first_group_at=item.first_group_at,
                    last_group_at=item.last_group_at,
                    run_count=item.run_count or 0,
                    total_tokens=item.total_tokens or 0,
                )
            )

    total_count = result.total_count if result else 0

    response = GetActivitySessionFactsResponse(
        items=items, total_count=total_count or 0
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "session_facts"],
    )

    return response


@router.post(
    "/get",
    response_model=GetActivitySessionFactsResponse,
    dependencies=[
        audit_activity(
            "views.activity.session_facts.get",
            "{{ actor.name }} fetched activity session facts data",
        )
    ],
)
async def get_activity_session_facts(
    request: GetActivitySessionFactsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivitySessionFactsResponse:
    """Get activity session facts data from mv_activity_session_facts."""
    tags = ["views", "activity", "session_facts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_activity_session_facts_internal(
            conn=conn,
            profile_id=request.profile_id,
            active=request.active,
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
            operation="views_activity_session_facts_get",
            request=http_request,
        )
