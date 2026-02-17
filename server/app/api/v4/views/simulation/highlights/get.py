"""Get endpoint for simulation highlights view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.highlights.types import (
    GetHighlightsRequest,
    GetHighlightsResponse,
    HighlightViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/highlights/get_attempt_highlight_view_complete.sql"

router = APIRouter()


async def get_attempt_highlight_internal(
    conn: asyncpg.Connection,
    strength_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[HighlightViewItem]:
    """Internal function for fetching highlights data."""
    from app.sql.types import GetSimulationHighlightsViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/highlights/get",
        {"strength_ids": [str(s) for s in strength_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [HighlightViewItem.model_validate(item) for item in cached["items"]]

    params = GetSimulationHighlightsViewSqlParams(strength_ids_filter=strength_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[HighlightViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                HighlightViewItem(
                    highlight_id=item.highlight_id,
                    strength_id=item.strength_id,
                    section=item.section,
                    idx=item.idx,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "highlights"],
    )
    return items


@router.post(
    "/get",
    response_model=GetHighlightsResponse,
    dependencies=[
        audit_activity(
            "views.simulation.highlights.get",
            "{{ actor.name }} fetched simulation highlights data",
        )
    ],
)
async def get_highlights(
    request: GetHighlightsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHighlightsResponse:
    tags = ["views", "simulation", "highlights"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_attempt_highlight_internal(
            conn=conn,
            strength_ids=request.strength_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetHighlightsResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_highlight_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
