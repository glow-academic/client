"""Get endpoint for activity logins view (mv_activity_logins)."""

from datetime import datetime
from typing import Annotated, Any
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

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if profile_id:
        conditions.append(f"profile_id = ${param_idx}")
        params.append(profile_id)
        param_idx += 1

    if profile_ids:
        conditions.append(f"profile_id = ANY(${param_idx}::uuid[])")
        params.append(profile_ids)
        param_idx += 1

    if active is not None:
        conditions.append(f"active = ${param_idx}")
        params.append(active)
        param_idx += 1

    if date_from:
        conditions.append(f"last_login >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"last_login < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    sort_column = {
        "last_login": "last_login",
        "created": "created_at",
    }.get(sort_by, "last_login")
    order_dir = "DESC" if sort_order == "desc" else "ASC"

    total_count = await conn.fetchval(
        f"SELECT COUNT(*) FROM mv_activity_logins WHERE {where_clause}", *params
    )

    data_query = f"""
        SELECT *
        FROM mv_activity_logins
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])
    rows = await conn.fetch(data_query, *params)

    items = [
        ActivityLoginItem(
            login_id=row["login_id"],
            profile_id=row["profile_id"],
            last_login=row["last_login"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            active=row["active"] or False,
            call_id=row["call_id"],
        )
        for row in rows
    ]

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
