"""Get endpoint for activity audits view (mv_activity_audits)."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.activity.audits.types import (
    ActivityAuditItem,
    GetActivityAuditsRequest,
    GetActivityAuditsResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


async def get_activity_audits_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    session_id: UUID | None = None,
    error: bool | None = None,
    endpoint: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetActivityAuditsResponse:
    """Internal function for fetching activity audits data."""
    cache_key_val = cache_key(
        "views/activity/audits/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
            "session_id": str(session_id) if session_id else None,
            "error": error,
            "endpoint": endpoint,
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
            return GetActivityAuditsResponse.model_validate(cached)

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if profile_id:
        conditions.append(f"profile_id = ${param_idx}")
        params.append(profile_id)
        param_idx += 1

    if session_id:
        conditions.append(f"session_id = ${param_idx}")
        params.append(session_id)
        param_idx += 1

    if error is not None:
        conditions.append(f"error = ${param_idx}")
        params.append(error)
        param_idx += 1

    if endpoint:
        conditions.append(f"endpoint ILIKE ${param_idx}")
        params.append(f"%{endpoint}%")
        param_idx += 1

    if date_from:
        conditions.append(f"created_at >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"created_at < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    order_dir = "DESC" if sort_order == "desc" else "ASC"

    total_count = await conn.fetchval(
        f"SELECT COUNT(*) FROM mv_activity_audits WHERE {where_clause}", *params
    )

    data_query = f"""
        SELECT *
        FROM mv_activity_audits
        WHERE {where_clause}
        ORDER BY created_at {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])
    rows = await conn.fetch(data_query, *params)

    items = [
        ActivityAuditItem(
            audit_id=row["audit_id"],
            created_at=row["created_at"],
            endpoint=row["endpoint"],
            message=row["message"],
            error=row["error"] or False,
            session_id=row["session_id"],
            profile_id=row["profile_id"],
        )
        for row in rows
    ]

    response = GetActivityAuditsResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "activity", "audits"],
    )

    return response


@router.post(
    "/get",
    response_model=GetActivityAuditsResponse,
    dependencies=[
        audit_activity(
            "views.activity.audits.get",
            "{{ actor.name }} fetched activity audits data",
        )
    ],
)
async def get_activity_audits(
    request: GetActivityAuditsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivityAuditsResponse:
    """Get activity audits data from mv_activity_audits."""
    tags = ["views", "activity", "audits"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_activity_audits_internal(
            conn=conn,
            profile_id=request.profile_id,
            session_id=request.session_id,
            error=request.error,
            endpoint=request.endpoint,
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
            operation="views_activity_audits_get",
            request=http_request,
        )
