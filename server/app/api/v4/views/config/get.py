"""Get endpoint for config view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.config.types import (
    ConfigViewItem,
    GetConfigRequest,
    GetConfigResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/config/get_config_view_complete.sql"

router = APIRouter()


async def get_config_internal(
    conn: asyncpg.Connection,
    config_id: UUID,
    bypass_cache: bool = False,
) -> list[ConfigViewItem]:
    """Internal function for fetching config data."""
    from app.sql.types import GetConfigViewSqlParams

    cache_key_val = cache_key(
        "views/config/get",
        {"config_id": str(config_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [ConfigViewItem.model_validate(item) for item in cached["items"]]

    params = GetConfigViewSqlParams(config_id_filter=config_id)

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[ConfigViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                ConfigViewItem(
                    config_id=item.config_id,
                    agents_id=item.agents_id,
                    models_id=item.models_id,
                    model_values_id=item.model_values_id,
                    providers_id=item.providers_id,
                    provider_values_id=item.provider_values_id,
                    endpoints_id=item.endpoints_id,
                    keys_id=item.keys_id,
                    prompts_id=item.prompts_id,
                    instructions_ids=list(item.instructions_ids)
                    if item.instructions_ids
                    else None,
                    temperature_levels_id=item.temperature_levels_id,
                    reasoning_levels_id=item.reasoning_levels_id,
                    qualities_id=item.qualities_id,
                    voices_id=item.voices_id,
                    tools_ids=list(item.tools_ids) if item.tools_ids else None,
                    created_at=item.created_at,
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "config"],
    )

    return items


@router.post(
    "/get",
    response_model=GetConfigResponse,
    dependencies=[
        audit_activity(
            "views.config.get",
            "{{ actor.name }} fetched config data",
        )
    ],
)
async def get_config(
    request: GetConfigRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetConfigResponse:
    """Get config data from the materialized view."""
    tags = ["views", "config"]

    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        items = await get_config_internal(
            conn=conn,
            config_id=request.config_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetConfigResponse(items=items)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_config_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
