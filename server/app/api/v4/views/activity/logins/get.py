"""Get endpoint for activity logins view (mv_activity_logins)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.activity.logins.types import (
    ActivityLoginItem,
    GetActivityLoginsRequest,
    GetActivityLoginsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/activity/logins/get_activity_logins_view_complete.sql"
)

router = APIRouter()


async def get_activity_logins_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    profile_ids: list[UUID] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    active: bool | None = None,
    sort_by: str = "last_login",
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityLoginsResponse:
    """Internal function for fetching activity logins data."""
    from app.sql.types import GetActivityLoginsViewSqlParams

    cache_key_val = cache_key(
        "views/activity/logins/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "profile_ids": [str(p) for p in profile_ids] if profile_ids else None,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "active": active,
            "sort_by": sort_by,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetActivityLoginsResponse.model_validate(cached)

    params = GetActivityLoginsViewSqlParams.model_construct(
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
                ActivityLoginItem(
                    login_id=item.login_id,
                    profile_id=item.profile_id,
                    last_login=item.last_login,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    active=item.active or False,
                    call_id=item.call_id,
                )
            )

    total_count = result.total_count if result else 0

    response = GetActivityLoginsResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "logins"],
    )

    return response


@router.post(
    "/get",
    response_model=GetActivityLoginsResponse,
    dependencies=[
        audit_activity(
            "views.activity.logins.get",
            "{{ actor.name }} fetched activity logins data",
        )
    ],
)
async def get_activity_logins(
    request: GetActivityLoginsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivityLoginsResponse:
    """Get activity logins data from mv_activity_logins."""
    tags = ["views", "activity", "logins"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_activity_logins_internal(
            conn=conn,
            profile_id=request.profile_id,
            date_from=request.date_from,
            date_to=request.date_to,
            active=request.active,
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
            operation="views_activity_logins_get",
            request=http_request,
        )
