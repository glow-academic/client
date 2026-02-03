"""Training list endpoint - POST /training/list.

ANALYTICAL endpoint: Returns simulation cards with stats AND paginated attempt history.

Unified endpoint for both home and practice modes, differentiated by
`practice: bool` parameter. Combines:
- Simulation overview cards (from simulation_overview_view)
- Attempt history (from mv_attempt_facts)
- Filter options

Python handles:
- Batch fetch resource metadata
- Business logic: score_status, show_view, show_continue, pass_pct, status
"""

from datetime import datetime
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.training.permissions import (
    compute_completion_pct,
    compute_mode,
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
    compute_status,
    compute_status_instructional,
    format_cohort_names,
)
from app.api.v4.artifacts.training.types import (
    FilterOption,
    GetTrainingListRequest,
    GetTrainingListResponse,
    StandardGroupMapping,
    StandardMapping,
    TrainingHistoryAttempt,
    TrainingSimulationCard,
)
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_batch_internal
from app.api.v4.views.analytics.attempts.get import get_attempt_facts_internal
from app.api.v4.views.analytics.attempts.types import AttemptFactsItem
from app.api.v4.views.simulation.overview.get import get_simulation_overview_internal
from app.api.v4.views.simulation.overview.types import OverviewViewItem
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeContextSqlParams,
    GetHomeContextSqlRow,
    GetPracticeContextSqlParams,
    GetPracticeContextSqlRow,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

HOME_CONTEXT_SQL_PATH = (
    "app/sql/v4/queries/analytics/NEW/home/get_home_context_complete.sql"
)
PRACTICE_CONTEXT_SQL_PATH = (
    "app/sql/v4/queries/analytics/NEW/practice/get_practice_context_complete.sql"
)

router = APIRouter()


# =============================================================================
# Simulation Card Transform (from overview view)
# =============================================================================


def _transform_simulation_card(
    card: OverviewViewItem,
    mode: str,
    practice: bool,
) -> TrainingSimulationCard:
    """Transform overview view item to simulation card.

    Python only computes derived business logic fields.

    Args:
        card: Overview view item with metadata already JOINed.
        mode: 'member', 'instructional', or 'practice'.
        practice: Whether this is practice mode.

    Returns:
        TrainingSimulationCard ready for API response.
    """
    # === PYTHON BUSINESS LOGIC: Compute derived fields ===

    # Compute pass_pct from rubric points
    pass_pct = compute_pass_pct(card.rubric_total_points, card.rubric_pass_points)

    # Compute status based on mode
    if mode == "instructional":
        status = compute_status_instructional(
            card.passed_count, card.in_progress_count, card.total_members
        )
        completion_pct = compute_completion_pct(
            card.passed_count, card.in_progress_count, card.total_members
        )
    else:
        # 'member' or 'practice' mode
        status = compute_status(card.has_passed, card.completed_count)
        completion_pct = None

    # Format cohort names as "A, B, and C"
    cohort_names_junction = format_cohort_names(card.cohort_names)

    # Convert standard_group_ids to strings
    standard_groups = (
        [str(sg_id) for sg_id in card.standard_group_ids]
        if card.standard_group_ids
        else None
    )

    return TrainingSimulationCard(
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
        cohort_names_junction=cohort_names_junction,
        # Instructional mode only
        completion_pct=completion_pct if mode == "instructional" else None,
        passed_count=card.passed_count if mode == "instructional" else None,
        in_progress_count=card.in_progress_count if mode == "instructional" else None,
        not_started_count=card.not_started_count if mode == "instructional" else None,
        # Practice mode only
        practice_simulation=True if practice else None,
    )


# =============================================================================
# Attempt Transform (from mv_attempt_facts)
# =============================================================================


def _transform_attempt(
    attempt: AttemptFactsItem,
    resource_meta: dict[str, dict[UUID, dict]],
    pass_threshold: float | None,
    practice: bool,
) -> TrainingHistoryAttempt:
    """Transform attempt facts item to API response.

    Merges resource metadata and computes business logic fields.

    Args:
        attempt: Attempt facts item with IDs only.
        resource_meta: Batch-fetched resource metadata.
        pass_threshold: Pass threshold from context for score classification.
        practice: Whether this is practice mode.

    Returns:
        TrainingHistoryAttempt ready for API response.
    """
    # === MERGE RESOURCE METADATA ===

    # Simulation metadata
    sim_meta = resource_meta["simulations"].get(attempt.simulation_id, {}) if attempt.simulation_id else {}
    simulation_name = sim_meta.get("name")
    time_limit = sim_meta.get("time_limit")

    # Profile metadata
    profile_meta = resource_meta["profiles"].get(attempt.profile_id, {}) if attempt.profile_id else {}
    profile_name = profile_meta.get("name")

    # Persona metadata (multiple personas per attempt)
    persona_names: list[str] = []
    persona_colors: list[str] = []
    if attempt.persona_ids:
        for pid in attempt.persona_ids:
            p_meta = resource_meta["personas"].get(pid, {})
            if p_meta.get("name"):
                persona_names.append(p_meta["name"])
            if p_meta.get("color"):
                persona_colors.append(p_meta["color"])

    # Scenario metadata (multiple scenarios per attempt)
    scenario_titles: list[str] = []
    if attempt.scenario_ids:
        for sid in attempt.scenario_ids:
            s_meta = resource_meta["scenarios"].get(sid, {})
            if s_meta.get("name"):
                scenario_titles.append(s_meta["name"])

    # === PYTHON BUSINESS LOGIC: Compute derived fields ===

    # Compute pass_pct from rubric points
    pass_pct = compute_pass_pct(attempt.rubric_total_points, attempt.rubric_pass_points)

    # Compute score_status using pass threshold
    score_status = compute_score_status(attempt.score_percent, pass_threshold)

    # Compute score (round score_percent)
    score = round(attempt.score_percent) if attempt.score_percent is not None else None

    # Get is_archived from the attempt (only meaningful for practice mode)
    # For home history, MV filters out archived, so always False
    is_archived = attempt.is_archived if practice else False

    # Compute show_view and show_continue
    show_view = compute_show_view(is_archived)

    num_incomplete_chats = (attempt.num_chats or 0) - (attempt.num_chats_completed or 0)
    show_continue = compute_show_continue(
        is_archived=is_archived,
        infinite_mode=attempt.infinite_mode,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        time_limit_seconds=time_limit,
        elapsed_seconds=attempt.total_time_seconds,
        num_incomplete_chats=num_incomplete_chats,
    )

    # Convert department_id to list of strings (for backwards compatibility)
    department_ids = [str(attempt.department_id)] if attempt.department_id else None

    # Cohort name (would need cohort resource fetch - for now use None)
    cohort_names = None

    # Derive practice_scenario_id from scenario_ids (first one if available)
    practice_scenario_id = attempt.scenario_ids[0] if attempt.scenario_ids else None

    return TrainingHistoryAttempt(
        attempt_id=attempt.attempt_id,
        date=attempt.attempt_created_at.isoformat() if attempt.attempt_created_at else None,
        profile_id=attempt.profile_id,
        profile_name=profile_name,
        simulation_id=attempt.simulation_id,
        simulation_name=simulation_name,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        infinite_mode=attempt.infinite_mode,
        time_limit=time_limit,
        persona_names_junction=persona_names if persona_names else None,
        persona_colors_junction=persona_colors if persona_colors else None,
        scenario_ids=attempt.scenario_ids,
        scenario_titles=scenario_titles if scenario_titles else None,
        department_ids=department_ids,
        cohort_names_junction=cohort_names,
        score=score,
        score_status=score_status,
        pass_pct=pass_pct,
        show_view=show_view,
        show_continue=show_continue,
        # Practice-only fields
        is_archived=is_archived if practice else None,
        practice_simulation=True if practice else None,
        practice_scenario_id=practice_scenario_id if practice else None,
    )


# =============================================================================
# Resource Metadata Fetch
# =============================================================================


async def _fetch_resource_metadata(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID],
    profile_ids: list[UUID],
    persona_ids: list[UUID],
    scenario_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[str, dict[UUID, dict]]:
    """Batch fetch resource metadata using internal handlers.

    Args:
        conn: Database connection
        simulation_ids: Unique simulation IDs to fetch
        profile_ids: Unique profile IDs to fetch
        persona_ids: Unique persona IDs to fetch
        scenario_ids: Unique scenario IDs to fetch
        bypass_cache: Skip cache lookup

    Returns:
        Dict with resource type -> id -> metadata mapping
    """
    result: dict[str, dict[UUID, dict]] = {
        "simulations": {},
        "profiles": {},
        "personas": {},
        "scenarios": {},
    }

    # Fetch simulations via internal handler (queries simulations_resource)
    if simulation_ids:
        items = await get_simulations_batch_internal(conn, simulation_ids, bypass_cache=bypass_cache)
        for item in items:
            if item.simulation_id:
                result["simulations"][item.simulation_id] = {
                    "name": item.title,
                    "description": item.description,
                    "time_limit": item.time_limit,
                }

    # Fetch profiles
    if profile_ids:
        items = await get_profiles_internal(conn, profile_ids, bypass_cache=bypass_cache)
        for item in items:
            if item.profile_id:
                result["profiles"][item.profile_id] = {
                    "name": item.name,
                }

    # Fetch personas
    if persona_ids:
        items = await get_personas_internal(conn, persona_ids, bypass_cache=bypass_cache)
        for item in items:
            if item.persona_id:
                result["personas"][item.persona_id] = {
                    "name": item.name,
                    "icon": item.icon,
                    "color": item.color,
                }

    # Fetch scenarios
    if scenario_ids:
        items = await get_scenarios_internal(conn, scenario_ids, bypass_cache=bypass_cache)
        for item in items:
            if item.scenario_id:
                result["scenarios"][item.scenario_id] = {
                    "name": item.name,
                    "description": item.description,
                }

    return result


# =============================================================================
# Main Endpoint
# =============================================================================


@router.post(
    "/list",
    response_model=GetTrainingListResponse,
    dependencies=[
        audit_activity("training.list", "{{ actor.name }} viewed training list")
    ],
)
async def training_list(
    request: GetTrainingListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTrainingListResponse:
    """Get training list with simulation cards and attempt history.

    ANALYTICAL endpoint: Returns both simulation overview cards AND
    paginated attempt history in a single response.

    Unified endpoint for home and practice modes, differentiated by
    `practice: bool` parameter.
    """
    practice = request.practice
    tags = ["training", "list", "practice" if practice else "home"]

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
            return GetTrainingListResponse.model_validate(cached["data"])

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

        # === QUERY: Context (for pass_threshold and actor_name) ===
        if practice:
            context_params = GetPracticeContextSqlParams(profile_id=resource_id)
            context = cast(
                GetPracticeContextSqlRow,
                await execute_sql_typed(conn, PRACTICE_CONTEXT_SQL_PATH, params=context_params),
            )
        else:
            context_params_home = GetHomeContextSqlParams(profile_id=resource_id)
            context = cast(
                GetHomeContextSqlRow,
                await execute_sql_typed(conn, HOME_CONTEXT_SQL_PATH, params=context_params_home),
            )

        # Set audit context
        if context.actor_name:
            audit_set(
                http_request, actor={"name": context.actor_name, "id": profile_id}
            )

        # === FETCH SIMULATION OVERVIEW ===
        overview_result = await get_simulation_overview_internal(
            conn=conn,
            profile_id=resource_id,
            simulation_ids=request.simulation_ids if not practice else None,
            cohort_ids=request.cohort_ids if not practice else None,
            department_ids=request.department_ids,
            practice=practice,
            start_date=request.start_date if not practice else None,
            end_date=request.end_date if not practice else None,
            bypass_cache=bypass_cache,
        )

        # Compute mode
        mode = compute_mode(practice, overview_result.user_role)

        # Transform simulation cards
        items: list[TrainingSimulationCard] = []
        for card in overview_result.items:
            items.append(_transform_simulation_card(card, mode, practice))

        # Convert standard groups
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

        # Convert standards
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

        # === FETCH ATTEMPT HISTORY ===
        # Parse dates
        date_from = datetime.fromisoformat(request.start_date) if request.start_date else None
        date_to = datetime.fromisoformat(request.end_date) if request.end_date else None

        # Compute page offset from page number
        page = request.page or 0
        page_size = request.page_size or 20
        page_offset = page * page_size

        # Convert practice bool to attempt_type string
        attempt_type = "practice" if practice else "general"

        facts_result = await get_attempt_facts_internal(
            conn=conn,
            profile_id=resource_id,
            attempt_type=attempt_type,
            is_archived=request.show_archived or False if practice else False,
            simulation_ids=request.simulation_ids,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            scenario_ids=request.scenario_ids,
            infinite_mode=request.infinite_mode,
            date_from=date_from,
            date_to=date_to,
            search=request.search,
            sort_by=request.sort_by or "date",
            sort_order=request.sort_order or "desc",
            page_limit=page_size,
            page_offset=page_offset,
            bypass_cache=bypass_cache,
        )

        # === COLLECT UNIQUE RESOURCE IDs ===
        all_simulation_ids: set[UUID] = set()
        all_profile_ids: set[UUID] = set()
        all_persona_ids: set[UUID] = set()
        all_scenario_ids: set[UUID] = set()

        for item in facts_result.items:
            if item.simulation_id:
                all_simulation_ids.add(item.simulation_id)
            if item.profile_id:
                all_profile_ids.add(item.profile_id)
            if item.persona_ids:
                all_persona_ids.update(item.persona_ids)
            if item.scenario_ids:
                all_scenario_ids.update(item.scenario_ids)

        # === BATCH FETCH RESOURCE METADATA ===
        resource_meta = await _fetch_resource_metadata(
            conn=conn,
            simulation_ids=list(all_simulation_ids),
            profile_ids=list(all_profile_ids),
            persona_ids=list(all_persona_ids),
            scenario_ids=list(all_scenario_ids),
            bypass_cache=bypass_cache,
        )

        # === TRANSFORM ATTEMPTS ===
        attempts: list[TrainingHistoryAttempt] = []
        for attempt in facts_result.items:
            attempts.append(_transform_attempt(attempt, resource_meta, context.pass_threshold, practice))

        # === CONVERT FILTER OPTIONS ===
        simulation_options = None
        if facts_result.simulation_options:
            simulation_options = []
            for opt in facts_result.simulation_options:
                if opt.value:
                    try:
                        sim_id = UUID(opt.value)
                        sim_meta = resource_meta["simulations"].get(sim_id, {})
                        label = sim_meta.get("name") or opt.value
                    except ValueError:
                        label = opt.value
                    simulation_options.append(
                        FilterOption(value=opt.value, label=label, count=opt.count or 0)
                    )

        scenario_options = None
        if facts_result.scenario_options:
            scenario_options = []
            for opt in facts_result.scenario_options:
                if opt.value:
                    try:
                        scn_id = UUID(opt.value)
                        scn_meta = resource_meta["scenarios"].get(scn_id, {})
                        label = scn_meta.get("name") or opt.value
                    except ValueError:
                        label = opt.value
                    scenario_options.append(
                        FilterOption(value=opt.value, label=label, count=opt.count or 0)
                    )

        # Practice-only: profile filter options
        profile_options = None
        if practice and facts_result.profile_options:
            profile_options = []
            for opt in facts_result.profile_options:
                if opt.value:
                    try:
                        prof_id = UUID(opt.value)
                        prof_meta = resource_meta["profiles"].get(prof_id, {})
                        label = prof_meta.get("name") or opt.value
                    except ValueError:
                        label = opt.value
                    profile_options.append(
                        FilterOption(value=opt.value, label=label, count=opt.count or 0)
                    )

        # === COMPUTE PAGINATION INFO ===
        total_count = facts_result.total_count
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

        # === BUILD RESPONSE ===
        api_response = GetTrainingListResponse(
            actor_name=context.actor_name,
            mode=mode,
            has_data=overview_result.has_data,
            # Simulation cards (overview)
            items=items,
            standard_groups=standard_groups,
            standards=standards,
            # Attempt history (paginated)
            data=attempts,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            # Filter options
            simulation_options=simulation_options,
            scenario_options=scenario_options,
            profile_options=profile_options,
        )

        # Cache response
        profile_specific_tags = tags + [
            f"training:profile:{profile_id}",
            f"list:profile:{profile_id}",
        ]
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
            operation="training_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
