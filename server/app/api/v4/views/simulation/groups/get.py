"""Get endpoint for simulation groups view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.simulation.groups.types import (
    GetGroupsRequest,
    GetGroupsResponse,
    GroupViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/simulation/groups/get_simulation_groups_view_complete.sql"

router = APIRouter()


async def get_simulation_groups_internal(
    conn: asyncpg.Connection,
    chat_id: UUID,
    bypass_cache: bool = False,
) -> list[GroupViewItem]:
    """Internal function for fetching group data.

    This can be reused by analytics routes that need group data.

    Args:
        conn: Database connection
        chat_id: Chat ID to fetch groups for
        bypass_cache: Skip cache lookup

    Returns:
        List of GroupViewItem objects
    """
    from app.sql.types import GetSimulationGroupsViewSqlParams

    cache_key_val = cache_key(
        "views/simulation/groups/get",
        {"chat_id": str(chat_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [GroupViewItem.model_validate(item) for item in cached["items"]]

    # Execute SQL query
    params = GetSimulationGroupsViewSqlParams(chat_id_filter=chat_id)

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    # Transform to response items
    items: list[GroupViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                GroupViewItem(
                    group_id=item.group_id,
                    groups_id=item.groups_id,
                    agents_id=item.agents_id,
                    models_id=item.models_id,
                    model_values_id=item.model_values_id,
                    providers_id=item.providers_id,
                    provider_values_id=item.provider_values_id,
                    endpoints_id=item.endpoints_id,
                    keys_id=item.keys_id,
                    prompts_id=item.prompts_id,
                    instructions_ids=list(item.instructions_ids) if item.instructions_ids else None,
                    temperature_levels_id=item.temperature_levels_id,
                    reasoning_levels_id=item.reasoning_levels_id,
                    qualities_id=item.qualities_id,
                    voices_id=item.voices_id,
                    tools_ids=list(item.tools_ids) if item.tools_ids else None,
                    custom_model=item.custom_model,
                    group_name=item.group_name,
                    trace_id=item.trace_id,
                    created_at=item.created_at,
                )
            )

    # Cache the result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "simulation", "groups"],
    )

    return items


@router.post(
    "/get",
    response_model=GetGroupsResponse,
    dependencies=[
        audit_activity(
            "views.simulation.groups.get",
            "{{ actor.name }} fetched simulation group data",
        )
    ],
)
async def get_groups(
    request: GetGroupsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetGroupsResponse:
    """Get simulation group data from the materialized view.

    This endpoint fetches group-level inference config data.
    """
    tags = ["views", "simulation", "groups"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        items = await get_simulation_groups_internal(
            conn=conn,
            chat_id=request.chat_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetGroupsResponse(items=items)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_simulation_groups_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
