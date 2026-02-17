"""Get endpoint for group list view."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.group.list.types import (
    GetGroupListViewResponse,
    GroupViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/group/list/get_group_list_view_complete.sql"

router = APIRouter()


async def get_group_list_view_internal(
    conn: asyncpg.Connection,
    group_ids: list[UUID] | None = None,
    session_id_filter: UUID | None = None,
    session_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "date",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetGroupListViewResponse:
    """Internal function for fetching group data from groups_mv."""
    from app.sql.types import GetGroupListViewSqlParams

    cache_key_val = cache_key(
        "views/group/list/get",
        {
            "group_ids": [str(g) for g in group_ids] if group_ids else None,
            "session_id_filter": str(session_id_filter) if session_id_filter else None,
            "session_ids": [str(s) for s in session_ids] if session_ids else None,
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
            return GetGroupListViewResponse.model_validate(cached)

    params = GetGroupListViewSqlParams(
        group_ids=group_ids,
        session_id_filter=session_id_filter,
        session_ids=session_ids,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_by_field=sort_by,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[GroupViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                GroupViewItem(
                    group_id=item.group_id,
                    session_id=item.session_id,
                    group_created_at=item.group_created_at,
                    trace_id=item.trace_id,
                    group_name=item.group_name,
                    active=item.active or False,
                )
            )

    response = GetGroupListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "group", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetGroupListViewResponse,
    dependencies=[
        audit_activity(
            "views.group.list.get",
            "{{ actor.name }} fetched group list data",
        )
    ],
)
async def get_groups(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupListViewResponse:
    """Get group data from the materialized view."""
    tags = ["views", "group", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_group_list_view_internal(
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
            operation="views_group_list_get",
            request=http_request,
        )
