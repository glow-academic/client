"""Get endpoint for session list view."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.session.list.types import (
    GetSessionListViewResponse,
    SessionViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/session/list/get_session_list_view_complete.sql"

router = APIRouter()


async def get_session_list_view_internal(
    conn: asyncpg.Connection,
    session_ids: list[UUID] | None = None,
    profile_id_filter: UUID | None = None,
    profile_ids_filter: list[UUID] | None = None,
    active_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetSessionListViewResponse:
    """Internal function for fetching session data from sessions_mv."""
    from app.sql.types import GetSessionListViewSqlParams

    cache_key_val = cache_key(
        "views/session/list/get",
        {
            "session_ids": [str(s) for s in session_ids] if session_ids else None,
            "profile_id_filter": str(profile_id_filter) if profile_id_filter else None,
            "profile_ids_filter": [str(p) for p in profile_ids_filter]
            if profile_ids_filter
            else None,
            "active_filter": active_filter,
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
            return GetSessionListViewResponse.model_validate(cached)

    params = GetSessionListViewSqlParams(
        session_ids=session_ids,
        profile_id_filter=profile_id_filter,
        profile_ids_filter=profile_ids_filter,
        active_filter=active_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[SessionViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                SessionViewItem(
                    session_id=item.session_id,
                    profile_id=item.profile_id,
                    session_created_at=item.session_created_at,
                    active=item.active or False,
                )
            )

    response = GetSessionListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "session", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetSessionListViewResponse,
    dependencies=[
        audit_activity(
            "views.session.list.get",
            "{{ actor.name }} fetched session list data",
        )
    ],
)
async def get_sessions(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSessionListViewResponse:
    """Get session data from the materialized view."""
    tags = ["views", "session", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_session_list_view_internal(
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
            operation="views_session_list_get",
            request=http_request,
        )
