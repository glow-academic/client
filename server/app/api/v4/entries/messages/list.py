"""Message list entries (migrated from views/message/list)."""

from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/message/list/get_message_list_view_complete.sql"


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

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

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
