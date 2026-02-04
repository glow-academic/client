"""Get endpoint for activity session facts view (mv_activity_session_facts)."""

from datetime import datetime
from typing import Annotated, Any
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

router = APIRouter()


async def get_activity_session_facts_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
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
    cache_key_val = cache_key(
        "views/activity/session_facts/get",
        {
            "profile_id": str(profile_id) if profile_id else None,
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

    conditions: list[str] = []
    params: list[Any] = []
    param_idx = 1

    if profile_id:
        conditions.append(f"profile_id = ${param_idx}")
        params.append(profile_id)
        param_idx += 1

    if active is not None:
        conditions.append(f"active = ${param_idx}")
        params.append(active)
        param_idx += 1

    if date_from:
        conditions.append(f"session_created_at >= ${param_idx}")
        params.append(date_from)
        param_idx += 1

    if date_to:
        conditions.append(f"session_created_at < ${param_idx}")
        params.append(date_to)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"

    sort_column = {
        "date": "session_created_at",
        "groups": "group_count",
        "runs": "run_count",
        "tokens": "total_tokens",
    }.get(sort_by, "session_created_at")

    order_dir = "DESC" if sort_order == "desc" else "ASC"

    count_query = f"SELECT COUNT(*) FROM mv_activity_session_facts WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_activity_session_facts
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        ActivitySessionFactsItem(
            session_id=row["session_id"],
            profile_id=row["profile_id"],
            session_created_at=row["session_created_at"],
            session_updated_at=row["session_updated_at"],
            active=row["active"] or False,
            group_count=row["group_count"] or 0,
            first_group_at=row["first_group_at"],
            last_group_at=row["last_group_at"],
            run_count=row["run_count"] or 0,
            total_tokens=row["total_tokens"] or 0,
        )
        for row in rows
    ]

    response = GetActivitySessionFactsResponse(items=items, total_count=total_count or 0)

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
