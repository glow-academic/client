"""ProfileDrafts entry GET endpoint."""

from typing import Annotated
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetProfileDraftsEntriesApiRequest,
    GetProfileDraftsEntriesApiResponse,
    GetProfileDraftsEntriesSqlParams,
    QGetProfileDraftsEntriesV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/profile_drafts/get_profile_drafts_entries_complete.sql"
)

router = APIRouter()


async def get_profile_drafts_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetProfileDraftsEntriesV4Item]:
    """Internal function to fetch profile_drafts entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "profile_drafts"]
    cache_key_val = cache_key(
        "/api/v4/entries/profile_drafts/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetProfileDraftsEntriesV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetProfileDraftsEntriesSqlParams(ids=ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[QGetProfileDraftsEntriesV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/profile_drafts/get",
    response_model=GetProfileDraftsEntriesApiResponse,
)
async def get_profile_drafts_entries(
    request: GetProfileDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileDraftsEntriesApiResponse:
    """Get profile_drafts entries by IDs."""
    tags = ["entries", "profile_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_profile_drafts_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProfileDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_drafts_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
