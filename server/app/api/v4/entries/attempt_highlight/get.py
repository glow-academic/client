"""Attempt Highlight entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAttemptHighlightEntriesApiRequest,
    GetAttemptHighlightEntriesApiResponse,
    GetAttemptHighlightEntriesSqlParams,
    GetAttemptHighlightEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_highlight/get_attempt_highlight_entries_complete.sql"
VIEW_SQL_PATH = "app/sql/v4/queries/views/simulation/highlights/get_simulation_highlights_view_complete.sql"

router = APIRouter()


class HighlightViewItem(BaseModel):
    """A single highlights view item."""

    highlight_id: UUID
    strength_id: UUID | None = None
    section: str | None = None
    idx: int | None = None
    created_at: datetime | None = None


async def get_attempt_highlight_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_highlight entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_highlight"]
    cache_key_val = cache_key(
        "/api/v4/entries/attempt_highlight/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptHighlightEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptHighlightEntriesSqlRow,
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


async def get_attempt_highlight_internal(
    conn: asyncpg.Connection,
    strength_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[HighlightViewItem]:
    """Internal function for fetching highlights data."""
    from app.sql.types import GetSimulationHighlightsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_highlight/view",
        {
            "strength_ids": [str(x) for x in strength_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [HighlightViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationHighlightsViewSqlParams(strength_ids_filter=strength_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[HighlightViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                HighlightViewItem(
                    highlight_id=item.highlight_id,
                    strength_id=item.strength_id,
                    section=item.section,
                    idx=item.idx,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_highlight"],
    )
    return items


@router.post(
    "/attempt_highlight/get",
    response_model=GetAttemptHighlightEntriesApiResponse,
)
async def get_attempt_highlight_entries(
    request: GetAttemptHighlightEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptHighlightEntriesApiResponse:
    """Get attempt_highlight entries by IDs."""
    tags = ["entries", "attempt_highlight"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_highlight_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptHighlightEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_highlight_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
