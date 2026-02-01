"""Practice overview endpoint - POST /practice/get.

Uses simulation overview view internal handler for data fetching.
Python handles business logic: status, pass_pct, cohort formatting.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.analytics.NEW.practice.permissions import (
    compute_mode,
    compute_pass_pct,
    compute_status,
    format_cohort_names,
)
from app.api.v4.analytics.NEW.practice.types import (
    GetPracticeOverviewNewClientRequest,
    GetPracticeOverviewNewResponse,
    PracticeSimulationCard,
    StandardGroupMapping,
    StandardMapping,
)
from app.api.v4.views.simulation.overview.get import get_simulation_overview_internal
from app.api.v4.views.simulation.overview.types import OverviewViewItem
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPracticeContextSqlParams,
    GetPracticeContextSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

CONTEXT_SQL_PATH = (
    "app/sql/v4/queries/analytics/NEW/practice/get_practice_context_complete.sql"
)

router = APIRouter()


def _transform_simulation_card(
    card: OverviewViewItem,
) -> PracticeSimulationCard:
    """Transform overview view item to API response.

    Python only computes derived business logic fields.

    Args:
        card: Overview view item with metadata already JOINed.

    Returns:
        PracticeSimulationCard ready for API response.
    """
    # === PYTHON BUSINESS LOGIC: Compute derived fields ===

    # Compute pass_pct from rubric points
    pass_pct = compute_pass_pct(card.rubric_total_points, card.rubric_pass_points)

    # Compute status based on practice mode (single user)
    status = compute_status(card.has_passed, card.completed_count)

    # Format cohort names as "A, B, and C"
    cohort_names_junction = format_cohort_names(card.cohort_names)

    # Convert standard_group_ids to strings
    standard_groups = (
        [str(sg_id) for sg_id in card.standard_group_ids]
        if card.standard_group_ids
        else None
    )

    return PracticeSimulationCard(
        view_mode=compute_mode(),  # Always 'practice'
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
        cohort_names_junction=cohort_names_junction,
        practice_simulation=True,  # Always True for practice
        practice_scenario_id=None,  # Not needed at overview level
    )


@router.post(
    "/get",
    response_model=GetPracticeOverviewNewResponse,
    dependencies=[
        audit_activity(
            "practice.new.get", "{{ actor.name }} viewed new practice overview"
        )
    ],
)
async def practice_get(
    request: GetPracticeOverviewNewClientRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPracticeOverviewNewResponse:
    """Get practice overview with simulation cards.

    Uses simulation overview view internal handler for data.
    Python handles only business logic (status, pass_pct, cohort formatting).
    """
    tags = ["practice", "new"]

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
            return GetPracticeOverviewNewResponse.model_validate(cached["data"])

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

        # === QUERY: Context (for actor_name) ===
        context_params = GetPracticeContextSqlParams(profile_id=resource_id)
        context = cast(
            GetPracticeContextSqlRow,
            await execute_sql_typed(conn, CONTEXT_SQL_PATH, params=context_params),
        )

        # Set audit context
        if context.actor_name:
            audit_set(
                http_request, actor={"name": context.actor_name, "id": profile_id}
            )

        # === FETCH DATA FROM VIEW INTERNAL HANDLER ===
        overview_result = await get_simulation_overview_internal(
            conn=conn,
            profile_id=resource_id,
            simulation_ids=None,
            cohort_ids=None,
            department_ids=request.department_ids,
            practice=True,  # Practice mode
            start_date=None,
            end_date=None,
            bypass_cache=bypass_cache,
        )

        # === TRANSFORM: Only compute business logic fields ===
        items: list[PracticeSimulationCard] = []
        for card in overview_result.items:
            items.append(_transform_simulation_card(card))

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
        api_response = GetPracticeOverviewNewResponse(
            actor_name=context.actor_name,
            mode=compute_mode(),  # Always 'practice'
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
            operation="practice_new_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
