"""Grants entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetGrantsEntriesApiRequest,
    GetGrantsEntriesApiResponse,
    GetGrantsEntriesSqlParams,
    GetGrantsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/grants/get_grants_entries_complete.sql"
VIEW_SQL_PATH = "app/sql/v4/queries/views/grant/list/get_grant_list_view_complete.sql"

router = APIRouter()


class GrantViewItem(BaseModel):
    """Single item from the grants list view."""

    grant_id: UUID
    grantor_id: UUID | None = None
    emulation_id: UUID | None = None
    emulated_id: UUID | None = None
    grant_session_id: UUID | None = None
    emulation_session_id: UUID | None = None
    expires_at: datetime | None = None
    used_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime | None = None


class GetGrantListViewResponse(BaseModel):
    """Response containing grants list data."""

    items: list[GrantViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_grants_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch grants entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "grants"]
    cache_key_val = cache_key(
        "/api/v4/entries/grants/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetGrantsEntriesSqlParams(ids=ids)
    result = cast(
        GetGrantsEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


async def get_grant_list_view_internal(
    conn: asyncpg.Connection,
    grantor_id_filter: UUID | None = None,
    emulated_id_filter: UUID | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetGrantListViewResponse:
    """Internal function for fetching grants data from MV."""
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

    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[GrantViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                GrantViewItem(
                    grant_id=item.grant_id,
                    grantor_id=item.grantor_id,
                    emulation_id=item.emulation_id,
                    emulated_id=item.emulated_id,
                    grant_session_id=item.grant_session_id,
                    emulation_session_id=item.emulation_session_id,
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
    "/grants/get",
    response_model=GetGrantsEntriesApiResponse,
)
async def get_grants_entries(
    request: GetGrantsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGrantsEntriesApiResponse:
    """Get grants entries by IDs."""
    tags = ["entries", "grants"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_grants_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetGrantsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_grants_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
