"""Home overview endpoint - POST /home/get.

Uses simulation overview view internal handler for data fetching.
Python handles business logic: status, pass_pct, completion_pct, cohort formatting.
"""

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.home.permissions import (
    compute_completion_pct,
    compute_mode,
    compute_pass_pct,
    compute_status,
    compute_status_instructional,
    format_cohort_names,
)
from app.api.v4.artifacts.home.types import (
    GetHomeOverviewNewResponse,
    SimulationCard,
    StandardGroupMapping,
    StandardMapping,
)
from app.api.v4.views.simulation.overview.get import get_simulation_overview_internal
from app.api.v4.views.simulation.overview.types import OverviewViewItem
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeOverviewNewApiRequest,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached

router = APIRouter()


def _transform_simulation_card(
    card: OverviewViewItem,
    mode: str,
) -> SimulationCard:
    """Transform overview view item to API response.

    Python only computes derived business logic fields.

    Args:
        card: Overview view item with metadata already JOINed.
        mode: 'member' or 'instructional'.

    Returns:
        SimulationCard ready for API response.
    """
    # === PYTHON BUSINESS LOGIC: Compute derived fields ===

    # Compute pass_pct from rubric points
    pass_pct = compute_pass_pct(card.rubric_total_points, card.rubric_pass_points)

    # Compute status based on mode
    if mode == "member":
        status = compute_status(card.has_passed, card.completed_count)
        completion_pct = None
    else:
        status = compute_status_instructional(
            card.passed_count, card.in_progress_count, card.total_members
        )
        completion_pct = compute_completion_pct(
            card.passed_count, card.in_progress_count, card.total_members
        )

    # Format cohort names as "A, B, and C"
    cohort_names_junction = format_cohort_names(card.cohort_names)

    # Convert standard_group_ids to strings
    standard_groups = (
        [str(sg_id) for sg_id in card.standard_group_ids]
        if card.standard_group_ids
        else None
    )

    return SimulationCard(
        view_mode=mode,
        simulation_id=card.simulation_id,
        simulation_name=card.simulation_name,
        simulation_description=card.simulation_description,
        time_limit=card.time_limit,
        num_sessions=card.attempt_count,
        highest_score=card.highest_score,
        standard_groups=standard_groups,
        color=card.persona_color,
        icon=card.persona_icon,
        has_passed=card.has_passed,
        status=status,
        pass_pct=pass_pct,
        completion_pct=completion_pct,
        passed_count=card.passed_count,
        in_progress_count=card.in_progress_count,
        not_started_count=card.not_started_count,
        cohort_names_junction=cohort_names_junction,
    )


@router.post(
    "/get",
    response_model=GetHomeOverviewNewResponse,
    dependencies=[
        audit_activity("home.get", "{{ actor.name }} viewed home overview")
    ],
)
async def home_get(
    request: GetHomeOverviewNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeOverviewNewResponse:
    """Get home overview with simulation cards.

    Uses simulation overview view internal handler for data.
    Python handles only business logic (status, pass_pct, completion_pct, cohort formatting).
    """
    tags = ["home"]

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
            return GetHomeOverviewNewResponse.model_validate(cached["data"])

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

        # Resolve artifact ID to resource ID via junction table
        resource_id = await conn.fetchval(
            """
            SELECT profiles_id FROM profile_profiles_junction
            WHERE profile_id = $1 AND active = true
            LIMIT 1
            """,
            profile_id,
        )
        if not resource_id:
            raise HTTPException(
                status_code=401,
                detail="Profile not found. Please sign in again.",
            )

        # === FETCH DATA FROM VIEW INTERNAL HANDLER ===
        overview_result = await get_simulation_overview_internal(
            conn=conn,
            profile_id=resource_id,
            simulation_ids=request.simulation_ids,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            practice=False,  # Home mode = non-practice
            start_date=request.start_date,
            end_date=request.end_date,
            bypass_cache=bypass_cache,
        )

        # === PYTHON BUSINESS LOGIC: Compute mode ===
        mode = compute_mode(overview_result.user_role)

        # Set audit context
        if overview_result.actor_name:
            audit_set(
                http_request,
                actor={"name": overview_result.actor_name, "id": profile_id},
            )

        # === TRANSFORM: Only compute business logic fields ===
        items: list[SimulationCard] = []
        for card in overview_result.items:
            items.append(_transform_simulation_card(card, mode))

        # === CONVERT STANDARD GROUPS/STANDARDS ===
        standard_groups = None
        if overview_result.standard_groups:
            standard_groups = [
                StandardGroupMapping(
                    standard_group_id=sg.standard_group_id,
                    name=sg.name,
                    description=sg.description,
                    points=sg.points,
                    pass_points=sg.pass_points,
                )
                for sg in overview_result.standard_groups
            ]

        standards = None
        if overview_result.standards:
            standards = [
                StandardMapping(
                    standard_id=st.standard_id,
                    standard_group_id=st.standard_group_id,
                    name=st.name,
                    description=st.description,
                    points=st.points,
                )
                for st in overview_result.standards
            ]

        # === BUILD RESPONSE ===
        api_response = GetHomeOverviewNewResponse(
            actor_name=overview_result.actor_name,
            mode=mode,
            has_data=overview_result.has_data,
            items=items,
            standard_groups=standard_groups,
            standards=standards,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
            tags=tags,
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
            operation="home_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
