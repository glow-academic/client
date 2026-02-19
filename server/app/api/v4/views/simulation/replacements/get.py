"""Get endpoint for simulation replacements view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.replacements.types import (
    GetReplacementsRequest,
    GetReplacementsResponse,
    ReplacementViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/replacements/get_simulation_replacements_view_complete.sql"

router = APIRouter()


async def get_attempt_replacement_internal(
    conn: asyncpg.Connection,
    improvement_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[ReplacementViewItem]:
    """Internal function for fetching replacements data."""
    from app.sql.types import GetSimulationReplacementsViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/replacements/get",
        {"improvement_ids": [str(i) for i in improvement_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                ReplacementViewItem.model_validate(item) for item in cached["items"]
            ]

    params = GetSimulationReplacementsViewSqlParams(
        improvement_ids_filter=improvement_ids
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ReplacementViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ReplacementViewItem(
                    replacement_id=item.replacement_id,
                    improvement_id=item.improvement_id,
                    section=item.section,
                    replace_text=item.replace_text,
                    idx=item.idx,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "replacements"],
    )
    return items


@router.post(
    "/get",
    response_model=GetReplacementsResponse,
    dependencies=[
        audit_activity(
            "views.simulation.replacements.get",
            "{{ actor.name }} fetched simulation replacements data",
        )
    ],
)
async def get_replacements(
    request: GetReplacementsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetReplacementsResponse:
    tags = ["views", "simulation", "replacements"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    try:
        items = await get_attempt_replacement_internal(
            conn=conn,
            improvement_ids=request.improvement_ids,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetReplacementsResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_attempt_replacement_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
