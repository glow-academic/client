"""Get endpoint for simulation strengths view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.strengths.types import (
    GetStrengthsRequest,
    GetStrengthsResponse,
    StrengthViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/strengths/get_simulation_strengths_view_complete.sql"

router = APIRouter()


async def get_attempt_strength_internal(
    conn: asyncpg.Connection,
    message_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[StrengthViewItem]:
    """Internal function for fetching strengths data."""
    from app.sql.types import GetSimulationStrengthsViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/strengths/get",
        {"message_ids": [str(id) for id in message_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [StrengthViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationStrengthsViewSqlParams(message_ids_filter=message_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[StrengthViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                StrengthViewItem(
                    strength_id=item.strength_id,
                    message_id=item.message_id,
                    name=item.name,
                    description=item.description,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "strengths"],
    )
    return items


@router.post(
    "/get",
    response_model=GetStrengthsResponse,
    dependencies=[
        audit_activity(
            "views.simulation.strengths.get",
            "{{ actor.name }} fetched simulation strengths data",
        )
    ],
)
async def get_strengths(
    request: GetStrengthsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetStrengthsResponse:
    tags = ["views", "simulation", "strengths"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_attempt_strength_internal(
            conn=conn,
            message_ids=request.message_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetStrengthsResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_strength_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
