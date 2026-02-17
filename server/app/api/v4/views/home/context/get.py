"""Get endpoint for home context view."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.home.context.types import (
    GetHomeContextViewResponse,
    HomeContextViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/home/context/get_home_context_view_complete.sql"

router = APIRouter()


async def get_home_context_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    bypass_cache: bool = False,
) -> GetHomeContextViewResponse:
    """Internal function for IDs-first home context data."""
    from app.sql.types import GetHomeContextViewSqlParams

    cache_key_val = cache_key(
        "views/home/context/get",
        {"profile_id": str(profile_id)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetHomeContextViewResponse.model_validate(cached)

    params = GetHomeContextViewSqlParams(
        profile_id_filter=profile_id,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[HomeContextViewItem] = []
    if result and result.items:
        for item in result.items:
            if not item.simulation_id:
                continue
            items.append(
                HomeContextViewItem(
                    simulation_id=item.simulation_id,
                    training_entry_ids=(
                        list(item.training_entry_ids)
                        if item.training_entry_ids
                        else None
                    ),
                    scenario_ids=list(item.scenario_ids) if item.scenario_ids else None,
                    cohort_ids=list(item.cohort_ids) if item.cohort_ids else None,
                    persona_ids=(list(item.persona_ids) if item.persona_ids else None),
                    rubric_ids=(list(item.rubric_ids) if item.rubric_ids else None),
                    time_limit_ids=(
                        list(item.time_limit_ids) if item.time_limit_ids else None
                    ),
                )
            )

    response = GetHomeContextViewResponse(
        items=items,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "home", "context"],
    )

    return response


@router.post(
    "/get",
    response_model=GetHomeContextViewResponse,
    dependencies=[
        audit_activity(
            "views.home.context.get",
            "{{ actor.name }} fetched home context view",
        )
    ],
)
async def get_home_context_view(
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeContextViewResponse:
    """Get home context view for current profile."""
    tags = ["views", "home", "context"]
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple | None = None

    try:
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required")

        result = await get_home_context_view_internal(
            conn=conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="views_home_context_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
