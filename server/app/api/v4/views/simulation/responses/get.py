"""Get endpoint for simulation responses view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.responses.types import (
    GetResponsesRequest,
    GetResponsesResponse,
    ResponseViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/responses/get_simulation_responses_view_complete.sql"

router = APIRouter()


async def get_simulation_responses_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[ResponseViewItem]:
    """Internal function for fetching responses data."""
    from app.sql.types import GetSimulationResponsesViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/responses/get",
        {"chat_ids": [str(c) for c in chat_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ResponseViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationResponsesViewSqlParams(chat_ids_filter=chat_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ResponseViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ResponseViewItem(
                    response_id=item.response_id,
                    chat_id=item.chat_id,
                    question_id=item.question_id,
                    option_id=item.option_id,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "responses"],
    )
    return items


@router.post(
    "/get",
    response_model=GetResponsesResponse,
    dependencies=[
        audit_activity(
            "views.simulation.responses.get",
            "{{ actor.name }} fetched simulation responses data",
        )
    ],
)
async def get_responses(
    request: GetResponsesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetResponsesResponse:
    tags = ["views", "simulation", "responses"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_simulation_responses_internal(
            conn=conn,
            chat_ids=request.chat_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetResponsesResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_simulation_responses_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
