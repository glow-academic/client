"""Home overview endpoint - POST /home/get.

Uses two-pass pattern:
1. Query 1 (Context): Fetch user context, permissions, and settings
2. Query 2 (Data): Fetch raw simulation data from MV + metadata from _resource tables
3. Python Business Logic: Transform raw data → simulation cards
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.analytics.NEW.home.permissions import (
    compute_completion_pct,
    compute_mode,
    compute_pass_pct,
    compute_status,
    compute_status_instructional,
    format_cohort_names,
)
from app.api.v4.analytics.NEW.home.types import (
    GetHomeOverviewNewResponse,
    SimulationCard,
    SimulationMapping,
    StandardGroupMapping,
    StandardMapping,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeContextSqlParams,
    GetHomeContextSqlRow,
    GetHomeOverviewNewApiRequest,
    GetHomeOverviewNewSqlParams,
    GetHomeOverviewNewSqlRow,
    QGetHomeOverviewNewV4RawSimulation,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

CONTEXT_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_context_complete.sql"
DATA_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_overview_new_complete.sql"

router = APIRouter()


def _build_metadata_lookups(
    data: GetHomeOverviewNewSqlRow,
) -> tuple[dict[UUID, Any], dict[UUID, Any], dict[UUID, Any], dict[UUID, list[UUID]]]:
    """Build lookup dictionaries from metadata arrays.

    Returns:
        Tuple of (simulations_by_id, personas_by_id, cohorts_by_id, rubrics_by_sim_id)
    """
    # Simulation metadata lookup
    simulations_by_id: dict[UUID, Any] = {}
    if data.simulations:
        for sim in data.simulations:
            if sim.simulation_id:
                simulations_by_id[sim.simulation_id] = sim

    # Persona metadata lookup
    personas_by_id: dict[UUID, Any] = {}
    if data.personas:
        for persona in data.personas:
            if persona.persona_id:
                personas_by_id[persona.persona_id] = persona

    # Cohort metadata lookup
    cohorts_by_id: dict[UUID, Any] = {}
    if data.cohorts:
        for cohort in data.cohorts:
            if cohort.cohort_id:
                cohorts_by_id[cohort.cohort_id] = cohort

    # Rubric → standard_group_ids lookup (by simulation_id)
    rubrics_by_sim_id: dict[UUID, list[UUID]] = {}
    if data.rubrics:
        for rubric in data.rubrics:
            if rubric.simulation_id and rubric.standard_group_ids:
                rubrics_by_sim_id[rubric.simulation_id] = rubric.standard_group_ids

    return simulations_by_id, personas_by_id, cohorts_by_id, rubrics_by_sim_id


def _transform_raw_simulation(
    raw: QGetHomeOverviewNewV4RawSimulation,
    mode: str,
    simulations_by_id: dict[UUID, Any],
    personas_by_id: dict[UUID, Any],
    cohorts_by_id: dict[UUID, Any],
    rubrics_by_sim_id: dict[UUID, list[UUID]],
) -> SimulationCard:
    """Transform a raw simulation record to a SimulationCard.

    Args:
        raw: Raw simulation data from SQL.
        mode: 'member' or 'instructional'.
        simulations_by_id: Simulation metadata lookup.
        personas_by_id: Persona metadata lookup.
        cohorts_by_id: Cohort metadata lookup.
        rubrics_by_sim_id: Rubric standard_group_ids lookup.

    Returns:
        SimulationCard ready for API response.
    """
    sim_id = raw.simulation_id

    # Get simulation metadata
    sim_meta = simulations_by_id.get(sim_id) if sim_id else None
    sim_name = sim_meta.name if sim_meta else None
    sim_description = sim_meta.description if sim_meta else None
    time_limit = sim_meta.time_limit if sim_meta else None

    # Get persona color/icon (use first persona)
    color = None
    icon = None
    if raw.persona_ids:
        for pid in raw.persona_ids:
            persona = personas_by_id.get(pid)
            if persona:
                color = persona.color
                icon = persona.icon
                break

    # Get cohort names
    cohort_names: list[str] = []
    if raw.cohort_ids:
        for cid in raw.cohort_ids:
            cohort = cohorts_by_id.get(cid)
            if cohort and cohort.name:
                cohort_names.append(cohort.name)

    # Get standard_group_ids
    standard_group_ids: list[str] = []
    if sim_id and sim_id in rubrics_by_sim_id:
        standard_group_ids = [str(sg_id) for sg_id in rubrics_by_sim_id[sim_id]]

    # Compute pass_pct from rubric points
    pass_pct = compute_pass_pct(raw.rubric_total_points, raw.rubric_pass_points)

    # Compute status based on mode
    if mode == "member":
        status = compute_status(raw.has_passed, raw.completed_count)
        completion_pct = None  # Not applicable for member mode
    else:
        status = compute_status_instructional(
            raw.passed_count, raw.in_progress_count, raw.total_members
        )
        completion_pct = compute_completion_pct(
            raw.passed_count, raw.in_progress_count, raw.total_members
        )

    return SimulationCard(
        view_mode=mode,
        simulation_id=sim_id,
        simulation_title=sim_name,
        simulation_description=sim_description,
        simulation_name=sim_name,
        time_limit=time_limit,
        num_sessions=raw.attempt_count,
        highest_score=raw.highest_score,
        standard_groups=standard_group_ids if standard_group_ids else None,
        color=color,
        icon=icon,
        has_passed=raw.has_passed,
        pass_rate=pass_pct,
        status=status,
        completion_pct=completion_pct,
        passed_count=raw.passed_count,
        in_progress_count=raw.in_progress_count,
        not_started_count=raw.not_started_count,
        pass_pct=pass_pct,
        cohort_name=cohort_names[0] if cohort_names else None,
        cohort_names_junction=format_cohort_names(cohort_names),
    )


@router.post(
    "/get",
    response_model=GetHomeOverviewNewResponse,
    dependencies=[
        audit_activity("home.new.get", "{{ actor.name }} viewed new home overview")
    ],
)
async def home_get(
    request: GetHomeOverviewNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeOverviewNewResponse:
    """Get home overview with simulation cards.

    Uses two-pass pattern:
    1. Context query for user info and permissions
    2. Data query for raw simulation data + metadata
    3. Python transforms raw data to simulation cards
    """
    tags = ["home", "new"]

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
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # === QUERY 1: Context (cheap, always fresh) ===
        context_params = GetHomeContextSqlParams(profile_id=profile_id)
        context = cast(
            GetHomeContextSqlRow,
            await execute_sql_typed(conn, CONTEXT_SQL_PATH, params=context_params),
        )

        # === PYTHON BUSINESS LOGIC: Compute mode ===
        mode = compute_mode(context.user_role)

        # === QUERY 2: Data Fetching (raw simulation data + metadata) ===
        request_dict = request.model_dump(mode="json")
        data_params = GetHomeOverviewNewSqlParams(
            **request_dict, profile_id=profile_id
        )  # type: ignore[arg-type]
        sql_params = data_params.to_tuple()

        data = cast(
            GetHomeOverviewNewSqlRow,
            await execute_sql_typed(conn, DATA_SQL_PATH, params=data_params),
        )

        # Set audit context
        if context.actor_name:
            audit_set(
                http_request, actor={"name": context.actor_name, "id": profile_id}
            )

        # === PYTHON BUSINESS LOGIC: Transform raw data to simulation cards ===
        (
            simulations_by_id,
            personas_by_id,
            cohorts_by_id,
            rubrics_by_sim_id,
        ) = _build_metadata_lookups(data)

        items: list[SimulationCard] = []
        if data.raw_simulations:
            for raw_sim in data.raw_simulations:
                card = _transform_raw_simulation(
                    raw_sim,
                    mode,
                    simulations_by_id,
                    personas_by_id,
                    cohorts_by_id,
                    rubrics_by_sim_id,
                )
                items.append(card)

        # Convert metadata to client-facing types
        standard_groups = None
        if data.standard_groups:
            standard_groups = [
                StandardGroupMapping(
                    standard_group_id=sg.standard_group_id,
                    name=sg.name,
                    description=sg.description,
                    points=sg.points,
                    pass_points=sg.pass_points,
                )
                for sg in data.standard_groups
            ]

        standards = None
        if data.standards:
            standards = [
                StandardMapping(
                    standard_id=st.standard_id,
                    standard_group_id=st.standard_group_id,
                    name=st.name,
                    description=st.description,
                    points=st.points,
                )
                for st in data.standards
            ]

        simulations = None
        if data.simulations:
            simulations = [
                SimulationMapping(
                    simulation_id=sim.simulation_id,
                    name=sim.name,
                    description=sim.description,
                    time_limit=sim.time_limit,
                    department_ids=sim.department_ids,
                )
                for sim in data.simulations
            ]

        # === BUILD RESPONSE ===
        api_response = GetHomeOverviewNewResponse(
            actor_name=context.actor_name,
            mode=mode,
            has_data=data.has_data,
            items=items,
            standard_groups=standard_groups,
            standards=standards,
            simulations=simulations,
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
            operation="home_new_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
