"""Training get endpoint - POST /training/get.

OPERATIONAL endpoint: Returns simulations user can take with scenario_ids.

Used to get data needed to START a simulation, not for analytics/history.
Frontend uses this to:
- Display available simulations
- Get scenario_ids for training_start socket event
- Show rubric data (standard_groups, standards) for pre-start display

Scoped by user's cohorts based on practice mode.
"""

from typing import Annotated, Any, cast

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
    StandardGroupMapping,
    StandardMapping,
    TrainingSimulationOperational,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetTrainingSimulationsSqlParams,
    GetTrainingSimulationsSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/generate/training/get_training_simulations_complete.sql"

router = APIRouter()


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
    """Get simulations available for training (operational).

    OPERATIONAL endpoint: Returns simulations user can take, scoped by
    their cohorts based on practice mode.

    Used by frontend to display available simulations and get data
    needed to start a training session (scenario_ids, etc).
    """
    practice = request.practice
    tags = ["training", "get", "practice" if practice else "home"]

    # Check for cache bypass header
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetTrainingGetResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (this is the artifact ID)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Execute SQL query
        params = GetTrainingSimulationsSqlParams(
            p_profile_id=profile_id,
            p_practice=practice,
        )

        result = cast(
            GetTrainingSimulationsSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        # Set audit context
        if result and result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
            )

        # Compute view mode from practice flag and user role
        user_role = result.user_role if result else None
        view_mode = compute_mode(practice, user_role)

        # Transform items with computed card fields
        items: list[TrainingSimulationOperational] = []
        if result and result.items:
            for item in result.items:
                # Compute pass_pct from rubric points
                pass_pct = compute_pass_pct(
                    item.rubric_total_points,
                    item.rubric_pass_points,
                )

                # Compute status from has_passed and attempt_count
                status = compute_status(
                    item.has_passed,
                    item.attempt_count,
                )

                # Format cohort names
                cohort_names_junction = format_cohort_names(
                    list(item.cohort_names) if item.cohort_names else None
                )

                # Round highest score
                highest_score = (
                    round(item.highest_score_percent)
                    if item.highest_score_percent is not None
                    else None
                )

                # Convert standard_group_ids to strings
                standard_groups = (
                    [str(sg_id) for sg_id in item.standard_group_ids]
                    if item.standard_group_ids
                    else None
                )

                items.append(
                    TrainingSimulationOperational(
                        simulation_id=item.simulation_id,
                        simulation_name=item.simulation_name,
                        simulation_description=item.simulation_description,
                        time_limit=item.time_limit,
                        scenario_ids=item.scenario_ids,
                        cohort_ids=item.cohort_ids,
                        color=item.color,
                        icon=item.icon,
                        # Card stats
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

        # Transform standard groups
        standard_groups: list[StandardGroupMapping] | None = None
        if result and result.standard_groups:
            standard_groups = [
                StandardGroupMapping(
                    standard_group_id=sg.standard_group_id,
                    name=sg.name,
                    description=sg.description,
                    points=sg.points,
                    pass_points=sg.pass_points,
                )
                for sg in result.standard_groups
                if sg.standard_group_id
            ]

        # Transform standards
        standards: list[StandardMapping] | None = None
        if result and result.standards:
            standards = [
                StandardMapping(
                    standard_id=st.standard_id,
                    standard_group_id=st.standard_group_id,
                    name=st.name,
                    description=st.description,
                    points=st.points,
                )
                for st in result.standards
                if st.standard_id
            ]

        # Build response
        api_response = GetTrainingGetResponse(
            actor_name=result.actor_name if result else None,
            items=items,
            standard_groups=standard_groups,
            standards=standards,
        )

        # Cache response
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
