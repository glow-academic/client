"""Get endpoint for simulation messages view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.messages.types import (
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

SQL_PATH = "app/sql/v4/queries/views/simulation/messages/get_simulation_messages_view_complete.sql"

router = APIRouter()


async def get_simulation_messages_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    bypass_cache: bool = False,
) -> list[MessageViewItem]:
    """Internal function for fetching messages data."""
    from app.sql.types import GetSimulationMessagesViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/messages/get",
        {"attempt_id": str(attempt_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [MessageViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationMessagesViewSqlParams(attempt_id_filter=attempt_id)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

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
                    completed=item.completed,
                    runs_id=item.runs_id,
                    text_id=item.text_id,
                    audio_id=item.audio_id,
                    history_content=item.history_content,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "messages"],
    )
    return items


@router.post(
    "/get",
    response_model=GetMessagesResponse,
    dependencies=[
        audit_activity(
            "views.simulation.messages.get",
            "{{ actor.name }} fetched simulation messages data",
        )
    ],
)
async def get_messages(
    request: GetMessagesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetMessagesResponse:
    tags = ["views", "simulation", "messages"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_simulation_messages_internal(
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
            operation="views_simulation_messages_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
