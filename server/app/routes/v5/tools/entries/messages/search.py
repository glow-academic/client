"""Messages search — filtered/paginated query against messages_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.messages.types import SearchMessageResponse
from app.sql.types import (
    GetMessageListViewSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

MV_NAME = "messages_mv"

LIST_SQL_PATH = "app/sql/queries/views/message/list/get_message_list_view_complete.sql"


async def search_messages(
    conn: asyncpg.Connection,
    run_id: UUID | None = None,
    role: str | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchMessageResponse]:
    """Search messages from messages_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT message_id, run_id, role, message_created_at,
               text_upload_ids, audio_upload_ids, image_upload_ids,
               video_upload_ids, file_upload_ids, call_upload_ids
        FROM {source}
        WHERE ($1::uuid IS NULL OR run_id = $1)
          AND ($2::text IS NULL OR role = $2)
        ORDER BY message_created_at DESC
        LIMIT $3 OFFSET $4
        """,
        run_id,
        role,
        limit,
        offset,
    )

    return [SearchMessageResponse(**dict(r)) for r in rows]


async def get_message_list_entries_internal(
    conn: asyncpg.Connection,
    run_id_filter: UUID | None = None,
    run_ids: list[UUID] | None = None,
    page_limit: int = 10000,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetMessageListViewSqlRow:
    """Internal function for fetching message data from messages_mv."""
    from app.infra.globals import get_redis_client
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
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetMessageListViewSqlRow.model_validate(cached)

    params = GetMessageListViewSqlParams(
        run_id_filter=run_id_filter,
        run_ids=run_ids,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, LIST_SQL_PATH, params=params)

    response = GetMessageListViewSqlRow(
        items=result.items if result else None,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["entries", "messages", "list"],
        redis=get_redis_client(),
    )

    return response
