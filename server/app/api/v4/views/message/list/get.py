"""Get endpoint for message list view."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.message.list.types import (
    GetMessageListViewResponse,
    MessageViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/message/list/get_message_list_view_complete.sql"

router = APIRouter()


async def get_message_list_view_internal(
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
        "views/message/list/get",
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

    items: list[MessageViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                MessageViewItem(
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
        tags=["views", "message", "list"],
    )

    return response


@router.post(
    "/get",
    response_model=GetMessageListViewResponse,
    dependencies=[
        audit_activity(
            "views.message.list.get",
            "{{ actor.name }} fetched message list data",
        )
    ],
)
async def get_messages(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetMessageListViewResponse:
    """Get message data from the materialized view."""
    tags = ["views", "message", "list"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        result = await get_message_list_view_internal(
            conn=conn,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_message_list_get",
            request=http_request,
        )
