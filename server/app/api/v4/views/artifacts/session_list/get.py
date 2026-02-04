"""Get endpoint for artifact session list view (mv_artifact_session_list)."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.artifacts.session_list.types import (
    ArtifactSessionListItem,
    GetArtifactSessionListRequest,
    GetArtifactSessionListResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import load_sql

router = APIRouter()

MV_SQL_PATH = "app/sql/v4/views/artifacts/mv_z_artifact_session_list.sql"


async def get_artifact_session_list_internal(
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
) -> GetArtifactSessionListResponse:
    """Internal function for fetching artifact session list data."""
    cache_key_val = cache_key(
        "views/artifacts/session_list/get",
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
            return GetArtifactSessionListResponse.model_validate(cached)

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
        "cost": "total_cost",
        "tokens": "total_tokens",
        "groups": "group_count",
        "runs": "run_count",
    }.get(sort_by, "session_created_at")

    order_dir = "DESC" if sort_order == "desc" else "ASC"

    mv_exists = await conn.fetchval(
        "SELECT to_regclass('public.mv_artifact_session_list')"
    )
    if mv_exists is None:
        await conn.execute(load_sql(MV_SQL_PATH))

    count_query = f"SELECT COUNT(*) FROM mv_artifact_session_list WHERE {where_clause}"
    total_count = await conn.fetchval(count_query, *params)

    data_query = f"""
        SELECT *
        FROM mv_artifact_session_list
        WHERE {where_clause}
        ORDER BY {sort_column} {order_dir}
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
    """
    params.extend([page_limit, page_offset])

    rows = await conn.fetch(data_query, *params)

    items = [
        ArtifactSessionListItem(
            session_id=row["session_id"],
            profile_id=row["profile_id"],
            profile_name=row["profile_name"],
            session_created_at=row["session_created_at"],
            session_updated_at=row["session_updated_at"],
            active=row["active"] or False,
            group_count=row["group_count"] or 0,
            run_count=row["run_count"] or 0,
            first_run_at=row["first_run_at"],
            last_run_at=row["last_run_at"],
            total_tokens=row["total_tokens"] or 0,
            total_cost=Decimal(str(row["total_cost"])) if row["total_cost"] else Decimal("0"),
            audit_count=row["audit_count"] or 0,
            last_audit_at=row["last_audit_at"],
            error_count=row["error_count"] or 0,
        )
        for row in rows
    ]

    response = GetArtifactSessionListResponse(items=items, total_count=total_count or 0)

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "artifacts", "session_list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetArtifactSessionListResponse,
    dependencies=[
        audit_activity(
            "views.artifacts.session_list.get",
            "{{ actor.name }} fetched artifact session list data",
        )
    ],
)
async def get_artifact_session_list(
    request: GetArtifactSessionListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetArtifactSessionListResponse:
    """Get artifact session list data from mv_artifact_session_list."""
    tags = ["views", "artifacts", "session_list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_artifact_session_list_internal(
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
            operation="views_artifacts_session_list_get",
            request=http_request,
        )
