"""Training get endpoint and shared training fetch helpers.

Three-layer style for training:
1. get_training_internal() - shared internal data fetch/hydration for client
2. get_training_websocket() - thin websocket payload for training socket handlers
3. get_training_client() - HTTP-facing response formatter
"""

from dataclasses import dataclass
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.training.permissions import (
    compute_mode,
    compute_pass_pct,
    compute_status,
    format_cohort_names,
)
from app.api.v4.artifacts.training.types import (
    GetTrainingGetRequest,
    GetTrainingGetResponse,
    GetTrainingWebsocketResponse,
    StandardGroupMapping,
    StandardMapping,
    TrainingSimulationOperational,
    TrainingWebsocketResources,
    TrainingWebsocketViews,
)
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.simulations.get import get_simulations_batch_internal
from app.api.v4.resources.standard_groups.get import get_standard_groups_internal
from app.api.v4.resources.standards.get import get_standards_internal
from app.api.v4.views.training.context.get import get_training_context_view_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import GetTrainingStartContextSqlParams, GetTrainingStartContextSqlRow
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

router = APIRouter()

SQL_PATH_START_CONTEXT = (
    "app/sql/v4/queries/generate/training/get_training_start_context_complete.sql"
)


@dataclass
class TrainingInternalData:
    actor_name: str | None
    user_role: str | None
    items: list[TrainingSimulationOperational]
    standard_groups: list[StandardGroupMapping] | None
    standards: list[StandardMapping] | None


async def get_training_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    practice: bool,
    bypass_cache: bool = False,
) -> TrainingInternalData:
    """Shared internal fetch for training client responses."""
    result = cast(
        Any,
        await get_training_context_view_internal(
            conn=conn,
            profile_id=profile_id,
            practice=practice,
            bypass_cache=bypass_cache,
        ),
    )

    user_role = result.user_role if result else None
    view_mode = compute_mode(practice, user_role)

    simulation_ids = (
        [item.simulation_id for item in result.items if item.simulation_id]
        if result and result.items
        else []
    )
    simulation_map = {
        item.simulation_id: item
        for item in await get_simulations_batch_internal(
            conn,
            simulation_ids,
            bypass_cache=bypass_cache,
        )
        if item.simulation_id
    }

    cohort_ids: set[UUID] = set()
    if result and result.items:
        for item in result.items:
            if item.cohort_ids:
                cohort_ids.update(item.cohort_ids)
    cohort_map = {
        item.cohort_id: item
        for item in await get_cohorts_internal(
            conn,
            list(cohort_ids),
            bypass_cache=bypass_cache,
        )
        if item.cohort_id
    }

    standard_group_ids = (
        list(result.standard_group_ids)
        if result and result.standard_group_ids
        else []
    )
    standard_groups_map = {
        item.standard_group_id: item
        for item in await get_standard_groups_internal(
            conn,
            standard_group_ids,
            bypass_cache=bypass_cache,
        )
        if item.standard_group_id
    }

    standard_ids = list(result.standard_ids) if result and result.standard_ids else []
    standards_map = {
        item.standard_id: item
        for item in await get_standards_internal(
            conn,
            standard_ids,
            bypass_cache=bypass_cache,
        )
        if item.standard_id
    }

    items: list[TrainingSimulationOperational] = []
    if result and result.items:
        for item in result.items:
            simulation = simulation_map.get(item.simulation_id)
            pass_pct = compute_pass_pct(
                item.rubric_total_points,
                item.rubric_pass_points,
            )
            status = compute_status(
                item.has_passed,
                item.attempt_count,
            )

            cohort_titles = (
                [
                    cohort_map[cid].title
                    for cid in item.cohort_ids
                    if cid in cohort_map and cohort_map[cid].title
                ]
                if item.cohort_ids
                else None
            )
            cohort_names_junction = format_cohort_names(cohort_titles)

            highest_score = (
                round(item.highest_score_percent)
                if item.highest_score_percent is not None
                else None
            )

            standard_groups = (
                [str(sg_id) for sg_id in item.standard_group_ids]
                if item.standard_group_ids
                else None
            )

            items.append(
                TrainingSimulationOperational(
                    simulation_id=item.simulation_id,
                    simulation_name=simulation.title if simulation else None,
                    simulation_description=(
                        simulation.description if simulation else None
                    ),
                    time_limit=simulation.time_limit if simulation else None,
                    training_bundle_entry_id=item.training_bundle_entry_id,
                    scenario_ids=item.scenario_ids,
                    cohort_ids=item.cohort_ids,
                    color=item.color,
                    icon=item.icon,
                    view_mode=view_mode,
                    num_sessions=item.attempt_count or 0,
                    highest_score=highest_score,
                    has_passed=item.has_passed,
                    status=status,
                    pass_pct=pass_pct,
                    cohort_names_junction=cohort_names_junction,
                    standard_groups=standard_groups,
                    practice_simulation=True if practice else None,
                )
            )

    standard_groups: list[StandardGroupMapping] | None = None
    if standard_group_ids:
        standard_groups = [
            StandardGroupMapping(
                standard_group_id=sg.standard_group_id,  # type: ignore[arg-type]
                name=sg.name,
                description=sg.description,
                points=sg.points,
                pass_points=sg.pass_points,
            )
            for sgid in standard_group_ids
            for sg in [standard_groups_map.get(sgid)]
            if sg and sg.standard_group_id
        ]

    standards: list[StandardMapping] | None = None
    if standard_ids:
        standards = [
            StandardMapping(
                standard_id=st.standard_id,  # type: ignore[arg-type]
                standard_group_id=st.standard_group_id,
                name=st.name,
                description=st.description,
                points=st.points,
            )
            for sid in standard_ids
            for st in [standards_map.get(sid)]
            if st and st.standard_id
        ]

    return TrainingInternalData(
        actor_name=result.actor_name if result else None,
        user_role=user_role,
        items=items,
        standard_groups=standard_groups,
        standards=standards,
    )


async def get_training_websocket(
    conn: asyncpg.Connection,
    profile_id: UUID,
    training_bundle_entry_id: UUID,
    department_id: UUID,
) -> GetTrainingWebsocketResponse:
    """Thin websocket fetch for training start flow."""
    params = GetTrainingStartContextSqlParams(
        p_profile_id=profile_id,
        p_training_bundle_entry_id=training_bundle_entry_id,
        p_department_id=department_id,
    )

    row = cast(
        GetTrainingStartContextSqlRow,
        await execute_sql_typed(conn, SQL_PATH_START_CONTEXT, params=params),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Training start context not found")

    return GetTrainingWebsocketResponse(
        views=TrainingWebsocketViews(
            training_bundle_entry_id=training_bundle_entry_id,
            department_id=department_id,
        ),
        resources=TrainingWebsocketResources(
            simulation_id=row.simulation_id,
            scenario_id=row.scenario_id,
            problem_statement=row.problem_statement,
            objectives=row.objectives,
            persona=row.persona,
            video_ids=list(row.video_ids) if row.video_ids else None,
            image_ids=list(row.image_ids) if row.image_ids else None,
            has_problem_statement=row.has_problem_statement or False,
            has_persona=row.has_persona or False,
            agent_exists=row.agent_exists or False,
            agent_name=row.agent_name,
            agent_is_active=row.agent_is_active or False,
            model_id=row.model_id,
            model_name=row.model_name,
            provider_id=row.provider_id,
            provider_name=row.provider_name,
            has_api_key=row.has_api_key or False,
            requests_per_day=row.requests_per_day,
            runs_today=int(row.runs_today or 0),
            simulation_exists=row.simulation_exists or False,
            simulation_is_active=row.simulation_is_active or False,
            profile_has_access=row.profile_has_access or False,
            valid_entry_types=list(row.valid_entry_types or []),
        ),
    )


async def get_training_client(
    conn: asyncpg.Connection,
    profile_id: UUID,
    practice: bool,
    bypass_cache: bool = False,
) -> GetTrainingGetResponse:
    """HTTP-facing training response builder."""
    data = await get_training_internal(
        conn=conn,
        profile_id=profile_id,
        practice=practice,
        bypass_cache=bypass_cache,
    )

    return GetTrainingGetResponse(
        actor_name=data.actor_name,
        items=data.items,
        standard_groups=data.standard_groups,
        standards=data.standards,
    )


@router.post(
    "/get",
    response_model=GetTrainingGetResponse,
    dependencies=[
        audit_activity("training.get", "{{ actor.name }} fetched training simulations")
    ],
)
async def training_get(
    request: GetTrainingGetRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTrainingGetResponse:
    """Get simulations available for training (operational)."""
    practice = request.practice
    tags = ["training", "get", "practice" if practice else "home"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetTrainingGetResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        api_response = await get_training_client(
            conn=conn,
            profile_id=profile_id,
            practice=practice,
            bypass_cache=bypass_cache,
        )

        if api_response.actor_name:
            audit_set(
                http_request,
                actor={"name": api_response.actor_name, "id": profile_id},
            )

        profile_specific_tags = tags + [f"training:profile:{profile_id}"]
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=profile_specific_tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="training_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
