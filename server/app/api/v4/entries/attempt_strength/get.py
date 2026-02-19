"""Attempt Strength entry GET endpoint."""

from datetime import datetime
from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAttemptStrengthEntriesApiRequest,
    GetAttemptStrengthEntriesApiResponse,
    GetAttemptStrengthEntriesSqlParams,
    GetAttemptStrengthEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_strength/get_attempt_strength_entries_complete.sql"
VIEW_SQL_PATH = "app/sql/v4/queries/views/simulation/strengths/get_simulation_strengths_view_complete.sql"

router = APIRouter()


class StrengthViewItem(BaseModel):
    """A single strengths view item."""

    strength_id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    created_at: datetime | None = None


async def get_attempt_strength_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_strength entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_strength"]
    cache_key_val = cache_key(
        "/api/v4/entries/attempt_strength/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptStrengthEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptStrengthEntriesSqlRow,
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


async def get_attempt_strength_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[StrengthViewItem]:
    """Internal function for fetching strengths data."""
    from app.sql.types import GetSimulationStrengthsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_strength/view",
        {
            "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [StrengthViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationStrengthsViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[StrengthViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                StrengthViewItem(
                    strength_id=item.strength_id,
                    message_id=item.message_id,
                    name=item.name,
                    description=item.description,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_strength"],
    )
    return items


@router.post(
    "/attempt_strength/get",
    response_model=GetAttemptStrengthEntriesApiResponse,
)
async def get_attempt_strength_entries(
    request: GetAttemptStrengthEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptStrengthEntriesApiResponse:
    """Get attempt_strength entries by IDs."""
    tags = ["entries", "attempt_strength"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_strength_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptStrengthEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_strength_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
