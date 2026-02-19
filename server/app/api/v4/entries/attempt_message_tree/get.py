"""Attempt Message Tree entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAttemptMessageTreeEntriesApiRequest,
    GetAttemptMessageTreeEntriesApiResponse,
    GetAttemptMessageTreeEntriesSqlParams,
    GetAttemptMessageTreeEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_message_tree/get_attempt_message_tree_entries_complete.sql"
VIEW_SQL_PATH = "app/sql/v4/queries/views/simulation/message_tree/get_simulation_message_tree_view_complete.sql"

router = APIRouter()


class MessageTreeViewItem(BaseModel):
    """A single message_tree view item."""

    message_id: UUID
    branch_path: list[UUID] | None = None
    depth: int | None = None


async def get_attempt_message_tree_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_message_tree entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_message_tree"]
    cache_key_val = cache_key(
        "/api/v4/entries/attempt_message_tree/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptMessageTreeEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptMessageTreeEntriesSqlRow,
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


async def get_attempt_message_tree_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[MessageTreeViewItem]:
    """Internal function for fetching message_tree data."""
    from app.sql.types import GetSimulationMessageTreeViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_message_tree/view",
        {
            "message_ids": [str(x) for x in message_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                MessageTreeViewItem.model_validate(item) for item in cached["items"]
            ]

    params = GetSimulationMessageTreeViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[MessageTreeViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                MessageTreeViewItem(
                    message_id=item.message_id,
                    branch_path=list(item.branch_path) if item.branch_path else None,
                    depth=item.depth,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_message_tree"],
    )
    return items


@router.post(
    "/attempt_message_tree/get",
    response_model=GetAttemptMessageTreeEntriesApiResponse,
)
async def get_attempt_message_tree_entries(
    request: GetAttemptMessageTreeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptMessageTreeEntriesApiResponse:
    """Get attempt_message_tree entries by IDs."""
    tags = ["entries", "attempt_message_tree"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_message_tree_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptMessageTreeEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_message_tree_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
