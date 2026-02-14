"""Get endpoint for activity list view."""

from datetime import date
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.activity.list.types import (
    ActivityViewItem,
    GetActivityListViewResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/activity/list/get_activity_list_view_complete.sql"

router = APIRouter()


async def get_activity_list_view_internal(
    conn: asyncpg.Connection,
    event_type_filter: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_order: str = "desc",
    page_limit: int = 1000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityListViewResponse:
    """Internal function for fetching activity data from mv_activity."""
    from app.sql.types import GetActivityListViewSqlParams

    cache_key_val = cache_key(
        "views/activity/list/get",
        {
            "event_type_filter": event_type_filter,
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
            return GetActivityListViewResponse.model_validate(cached)

    params = GetActivityListViewSqlParams(
        event_type_filter=event_type_filter,
        date_from=date_from,
        date_to=date_to,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ActivityViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ActivityViewItem(
                    date_key=item.date_key,
                    event_type=item.event_type,
                    event_count=item.event_count or 0,
                    unique_profiles=item.unique_profiles or 0,
                    saved_count=item.saved_count or 0,
                    created_count=item.created_count or 0,
                    duplicated_count=item.duplicated_count or 0,
                    uploaded_count=item.uploaded_count or 0,
                    deleted_count=item.deleted_count or 0,
                    updated_count=item.updated_count or 0,
                )
            )

    response = GetActivityListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetActivityListViewResponse,
    dependencies=[
        audit_activity(
            "views.activity.list.get",
            "{{ actor.name }} fetched activity list data",
        )
    ],
)
async def get_activity(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivityListViewResponse:
    """Get activity data from the materialized view."""
    tags = ["views", "activity", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_activity_list_view_internal(
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
            operation="views_activity_list_get",
            request=http_request,
        )
