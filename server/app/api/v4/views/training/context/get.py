"""Get endpoint for training context view."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.training.context.types import (
    GetTrainingContextViewResponse,
    TrainingContextViewItem,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/training/context/get_training_context_view_complete.sql"
)

router = APIRouter()


async def get_training_context_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    practice: bool,
    bypass_cache: bool = False,
) -> GetTrainingContextViewResponse:
    """Internal function for IDs-first training context data."""
    from app.sql.types import GetTrainingContextViewSqlParams

    cache_key_val = cache_key(
        "views/training/context/get",
        {"profile_id": str(profile_id), "practice": practice},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetTrainingContextViewResponse.model_validate(cached)

    params = GetTrainingContextViewSqlParams(
        profile_id_filter=profile_id,
        practice_filter=practice,
    )
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[TrainingContextViewItem] = []
    if result and result.items:
        for item in result.items:
            if not item.simulation_id:
                continue
            items.append(
                TrainingContextViewItem(
                    simulation_id=item.simulation_id,
                    training_bundle_entry_ids=(
                        list(item.training_bundle_entry_ids)
                        if item.training_bundle_entry_ids
                        else None
                    ),
                    scenario_ids=list(item.scenario_ids) if item.scenario_ids else None,
                    cohort_ids=list(item.cohort_ids) if item.cohort_ids else None,
                    persona_ids=(list(item.persona_ids) if item.persona_ids else None),
                    rubric_ids=(list(item.rubric_ids) if item.rubric_ids else None),
                )
            )

    # actor_name and user_role come from get_profile_context_internal() in the
    # artifact layer, not from this SQL query.
    response = GetTrainingContextViewResponse(
        items=items,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "training", "context"],
    )

    return response


@router.post(
    "/get",
    response_model=GetTrainingContextViewResponse,
    dependencies=[
        audit_activity(
            "views.training.context.get",
            "{{ actor.name }} fetched training context view",
        )
    ],
)
async def get_training_context_view(
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    practice: bool = False,
) -> GetTrainingContextViewResponse:
    """Get training context view for current profile and mode."""
    tags = ["views", "training", "context", "practice" if practice else "home"]
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple | None = None

    try:
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(status_code=401, detail="Profile ID is required")

        result = await get_training_context_view_internal(
            conn=conn,
            profile_id=profile_id,
            practice=practice,
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
            operation="views_training_context_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
