"""Get endpoint for grant list view."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.grant.list.types import (
    GetGrantListViewResponse,
    GrantViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/grant/list/get_grant_list_view_complete.sql"

router = APIRouter()


async def get_grant_list_view_internal(
    conn: asyncpg.Connection,
    grantor_id_filter: UUID | None = None,
    emulated_id_filter: UUID | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetGrantListViewResponse:
    """Internal function for fetching grant data from mv_grants."""
    from app.sql.types import GetGrantListViewSqlParams

    cache_key_val = cache_key(
        "views/grant/list/get",
        {
            "grantor_id_filter": str(grantor_id_filter) if grantor_id_filter else None,
            "emulated_id_filter": str(emulated_id_filter)
            if emulated_id_filter
            else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetGrantListViewResponse.model_validate(cached)

    params = GetGrantListViewSqlParams(
        grantor_id_filter=grantor_id_filter,
        emulated_id_filter=emulated_id_filter,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[GrantViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                GrantViewItem(
                    grant_id=item.grant_id,
                    grantor_id=item.grantor_id,
                    emulation_id=item.emulation_id,
                    emulated_id=item.emulated_id,
                    session_id=item.session_id,
                    expires_at=item.expires_at,
                    used_at=item.used_at,
                    revoked_at=item.revoked_at,
                    created_at=item.created_at,
                )
            )

    response = GetGrantListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "grant", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetGrantListViewResponse,
    dependencies=[
        audit_activity(
            "views.grant.list.get",
            "{{ actor.name }} fetched grant list data",
        )
    ],
)
async def get_grants(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGrantListViewResponse:
    """Get grant data from the materialized view."""
    tags = ["views", "grant", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_grant_list_view_internal(
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
            operation="views_grant_list_get",
            request=http_request,
        )
