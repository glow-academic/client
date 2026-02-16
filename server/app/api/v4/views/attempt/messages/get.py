"""Get endpoint for attempt messages view (lean — no composites)."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.attempt.messages.types import (
    GetMessagesRequest,
    GetMessagesResponse,
    MessageViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/attempt/messages/get_attempt_messages_view_complete.sql"
)

router = APIRouter()


async def get_attempt_messages_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> list[MessageViewItem]:
    """Internal function for fetching lean message data.

    Lean: entry attrs + resource IDs only. Composites (contents, strengths,
    improvements, hints, branch_path) fetched via simulation/* views.
    """
    from app.sql.types import (
        GetAttemptMessagesViewSqlParams,
    )

    cache_key_val = cache_key(
        "views/attempt/messages/get",
        {"attempt_id": str(attempt_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [MessageViewItem.model_validate(item) for item in cached["items"]]

    # Execute SQL query
    params = GetAttemptMessagesViewSqlParams(attempt_id_filter=attempt_id)

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response items (flat — no composite transforms needed)
    items: list[MessageViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                MessageViewItem(
                    message_id=item.message_id,
                    chat_id=item.chat_id,
                    attempt_id=item.attempt_id,
                    type=item.type,
                    created_at=item.created_at,
                    completed=item.completed or False,
                    runs_id=item.runs_id,
                    history_content=item.history_content,
                    audio_id=item.audio_id,
                )
            )

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "attempt", "messages"],
    )

    return items


@router.post(
    "/get",
    response_model=GetMessagesResponse,
    dependencies=[
        audit_activity(
            "views.attempt.messages.get",
            "{{ actor.name }} fetched attempt message data",
        )
    ],
)
async def get_messages(
    request: GetMessagesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetMessagesResponse:
    """Get attempt message data from the materialized view."""
    tags = ["views", "attempt", "messages"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        items = await get_attempt_messages_internal(
            conn=conn,
            attempt_id=request.attempt_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetMessagesResponse(items=items)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_messages_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
