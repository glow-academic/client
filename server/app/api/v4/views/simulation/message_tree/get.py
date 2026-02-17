"""Get endpoint for simulation message_tree view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.message_tree.types import (
    GetMessageTreeRequest,
    GetMessageTreeResponse,
    MessageTreeViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/message_tree/get_attempt_message_tree_view_complete.sql"

router = APIRouter()


async def get_attempt_message_tree_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[MessageTreeViewItem]:
    """Internal function for fetching message_tree data."""
    from app.sql.types import GetSimulationMessageTreeViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/message_tree/get",
        {"message_ids": [str(id) for id in message_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                MessageTreeViewItem.model_validate(item) for item in cached["items"]
            ]

    params = GetSimulationMessageTreeViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[MessageTreeViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                MessageTreeViewItem(
                    message_id=item.message_id,
                    branch_path=item.branch_path,
                    depth=item.depth,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "message_tree"],
    )
    return items


@router.post(
    "/get",
    response_model=GetMessageTreeResponse,
    dependencies=[
        audit_activity(
            "views.simulation.message_tree.get",
            "{{ actor.name }} fetched simulation message_tree data",
        )
    ],
)
async def get_message_tree(
    request: GetMessageTreeRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetMessageTreeResponse:
    tags = ["views", "simulation", "message_tree"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_attempt_message_tree_internal(
            conn=conn,
            message_ids=request.message_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetMessageTreeResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_message_tree_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
