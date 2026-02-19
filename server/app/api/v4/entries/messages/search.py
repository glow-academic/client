"""Messages entry SEARCH endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SearchMessagesEntriesApiRequest,
    SearchMessagesEntriesApiResponse,
    SearchMessagesEntriesSqlParams,
    SearchMessagesEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SEARCH_SQL_PATH = "app/sql/v4/queries/entries/messages/search_messages_entries_complete.sql"
LIST_SQL_PATH = "app/sql/v4/queries/views/message/list/get_message_list_view_complete.sql"

router = APIRouter()


# ---------------------------------------------------------------------------
# Types (merged from list.py)
# ---------------------------------------------------------------------------


class MessageListViewItem(BaseModel):
    """Single message from the message list."""

    message_id: UUID
    run_id: UUID | None = None
    role: str | None = None
    message_created_at: str | None = None
    contents: list[str] = Field(default_factory=list)
    call_ids: list[UUID] = Field(default_factory=list)


class GetMessageListViewResponse(BaseModel):
    """Response containing message list data."""

    items: list[MessageListViewItem] = Field(
        default_factory=list, description="Message data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")


# ---------------------------------------------------------------------------
# Search (original search.py)
# ---------------------------------------------------------------------------


async def search_messages_entries_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    run_id: UUID | None = None,
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to search messages entries."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["entries", "messages"]
    cache_key_val = cache_key(
        "/api/v4/entries/messages/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "run_id": str(run_id) if run_id else None,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = SearchMessagesEntriesSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        run_id=run_id,
    )
    result = cast(
        SearchMessagesEntriesSqlRow,
        await execute_sql_typed(conn, SEARCH_SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/messages/search",
    response_model=SearchMessagesEntriesApiResponse,
)
async def search_messages_entries(
    request: SearchMessagesEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchMessagesEntriesApiResponse:
    """Search messages entries."""
    tags = ["entries", "messages"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_messages_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchMessagesEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_messages_entries",
            sql_query=load_sql_query(SEARCH_SQL_PATH),
            sql_params=None,
            request=http_request,
        )


# ---------------------------------------------------------------------------
# List (merged from list.py)
# ---------------------------------------------------------------------------


async def get_message_list_entries_internal(
    conn: asyncpg.Connection,
    run_id_filter: UUID | None = None,
    run_ids: list[UUID] | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetMessageListViewResponse:
    """Internal function for fetching message data from messages_mv."""
    from app.sql.types import GetMessageListViewSqlParams

    cache_key_val = cache_key(
        "entries/messages/list/get",
        {
            "run_id_filter": str(run_id_filter) if run_id_filter else None,
            "run_ids": [str(r) for r in run_ids] if run_ids else None,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetMessageListViewResponse.model_validate(cached)

    params = GetMessageListViewSqlParams(
        run_id_filter=run_id_filter,
        run_ids=run_ids,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    items: list[MessageListViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                MessageListViewItem(
                    message_id=item.message_id,
                    run_id=item.run_id,
                    role=item.role,
                    message_created_at=item.message_created_at,
                    contents=list(item.contents) if item.contents else [],
                    call_ids=list(item.call_ids) if item.call_ids else [],
                )
            )

    response = GetMessageListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "messages", "list"],
    )

    return response
