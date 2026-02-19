"""View wrapper for calls list entries."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/call/list/get_call_list_view_complete.sql"


class CallViewItem(BaseModel):
    """Single item from the calls list view."""

    call_id: UUID
    run_id: UUID | None = None
    call_created_at: datetime | None = None
    arguments_raw: str | None = None
    tool_id: UUID | None = None


class GetCallListViewResponse(BaseModel):
    """Response containing calls list data."""

    items: list[CallViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_call_list_view_internal(
    conn: asyncpg.Connection,
    run_id_filter: UUID | None = None,
    run_ids: list[UUID] | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetCallListViewResponse:
    """Internal function for fetching calls data from MV."""
    from app.sql.types import GetCallListViewSqlParams

    cache_key_val = cache_key(
        "views/call/list/get",
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
            return GetCallListViewResponse.model_validate(cached)

    params = GetCallListViewSqlParams(
        run_id_filter=run_id_filter,
        run_ids=run_ids,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[CallViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                CallViewItem(
                    call_id=item.call_id,
                    run_id=item.run_id,
                    call_created_at=item.call_created_at,
                    arguments_raw=item.arguments_raw,
                    tool_id=item.tool_id,
                )
            )

    response = GetCallListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "call", "list"],
    )

    return response
