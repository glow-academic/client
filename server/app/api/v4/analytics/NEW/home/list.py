"""Home history endpoint - POST /home/list.

Uses two-pass pattern:
1. Query 1 (Context): Fetch user context, permissions, and settings
2. Query 2 (Data): Fetch raw attempt data + metadata from MV + _resource tables
3. Python Business Logic: Search, filter, sort, paginate, compute fields
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.analytics.NEW.home.permissions import (
    compute_mode,
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
)
from app.api.v4.analytics.NEW.home.types import (
    FilterOption,
    GetHomeHistoryNewClientRequest,
    GetHomeHistoryNewResponse,
    HistoryAttempt,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeContextSqlParams,
    GetHomeContextSqlRow,
    GetHomeHistoryNewSqlParams,
    GetHomeHistoryNewSqlRow,
    QGetHomeHistoryNewV4RawAttempt,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

CONTEXT_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_context_complete.sql"
DATA_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_history_new_complete.sql"

router = APIRouter()


def _build_metadata_lookups(
    data: GetHomeHistoryNewSqlRow,
) -> tuple[
    dict[UUID, Any],
    dict[UUID, Any],
    dict[UUID, Any],
    dict[UUID, Any],
    dict[UUID, int],
]:
    """Build lookup dictionaries from metadata arrays.

    Returns:
        Tuple of (simulations_by_id, profiles_by_id, personas_by_id, scenarios_by_id, time_limits_by_scenario)
    """
    # Simulation metadata lookup
    simulations_by_id: dict[UUID, Any] = {}
    if data.simulations:
        for sim in data.simulations:
            if sim.simulation_id:
                simulations_by_id[sim.simulation_id] = sim

    # Profile metadata lookup
    profiles_by_id: dict[UUID, Any] = {}
    if data.profiles:
        for profile in data.profiles:
            if profile.profile_id:
                profiles_by_id[profile.profile_id] = profile

    # Persona metadata lookup
    personas_by_id: dict[UUID, Any] = {}
    if data.personas:
        for persona in data.personas:
            if persona.persona_id:
                personas_by_id[persona.persona_id] = persona

    # Scenario metadata lookup
    scenarios_by_id: dict[UUID, Any] = {}
    if data.scenarios:
        for scenario in data.scenarios:
            if scenario.scenario_id:
                scenarios_by_id[scenario.scenario_id] = scenario

    # Cohort metadata lookup
    cohorts_by_id: dict[UUID, Any] = {}
    if data.cohorts:
        for cohort in data.cohorts:
            if cohort.cohort_id:
                cohorts_by_id[cohort.cohort_id] = cohort

    # Time limits lookup (by scenario_id)
    time_limits_by_scenario: dict[UUID, int] = {}
    if data.time_limits:
        for tl in data.time_limits:
            if tl.scenario_id and tl.time_limit_seconds is not None:
                time_limits_by_scenario[tl.scenario_id] = tl.time_limit_seconds

    return (
        simulations_by_id,
        profiles_by_id,
        personas_by_id,
        scenarios_by_id,
        time_limits_by_scenario,
    )


def _compute_time_limit(
    scenario_ids: list[UUID] | None,
    time_limits_by_scenario: dict[UUID, int],
) -> int | None:
    """Compute total time limit for an attempt from scenario time limits.

    Args:
        scenario_ids: List of scenario IDs in the attempt.
        time_limits_by_scenario: Lookup dict of scenario_id -> time_limit_seconds.

    Returns:
        Total time limit in seconds, or None if any scenario has no limit.
    """
    if not scenario_ids:
        return None
    total = 0
    for sid in scenario_ids:
        limit = time_limits_by_scenario.get(sid)
        if limit is None:
            return None  # No limit means unlimited
        total += limit
    return total


def _transform_raw_attempt(
    raw: QGetHomeHistoryNewV4RawAttempt,
    pass_threshold: float | None,
    simulations_by_id: dict[UUID, Any],
    profiles_by_id: dict[UUID, Any],
    personas_by_id: dict[UUID, Any],
    scenarios_by_id: dict[UUID, Any],
    cohorts_by_id: dict[UUID, Any],
    time_limits_by_scenario: dict[UUID, int],
) -> HistoryAttempt:
    """Transform a raw attempt record to a HistoryAttempt.

    Args:
        raw: Raw attempt data from SQL.
        pass_threshold: The pass threshold from context.
        simulations_by_id: Simulation metadata lookup.
        profiles_by_id: Profile metadata lookup.
        personas_by_id: Persona metadata lookup.
        scenarios_by_id: Scenario metadata lookup.
        cohorts_by_id: Cohort metadata lookup.
        time_limits_by_scenario: Time limit lookup by scenario ID.

    Returns:
        HistoryAttempt ready for API response.
    """
    # Get simulation metadata
    sim_meta = simulations_by_id.get(raw.simulation_id) if raw.simulation_id else None
    sim_name = sim_meta.name if sim_meta else None
    department_ids = (
        [str(d) for d in sim_meta.department_ids] if sim_meta and sim_meta.department_ids else None
    )

    # Get profile metadata
    profile_meta = profiles_by_id.get(raw.profile_id) if raw.profile_id else None
    profile_name = profile_meta.name if profile_meta else None

    # Get persona names and colors
    persona_names: list[str] = []
    persona_colors: list[str] = []
    if raw.persona_ids:
        for pid in raw.persona_ids:
            persona = personas_by_id.get(pid)
            if persona:
                if persona.name:
                    persona_names.append(persona.name)
                if persona.color:
                    persona_colors.append(persona.color)

    # Get scenario titles
    scenario_titles: list[str] = []
    if raw.scenario_ids:
        for sid in raw.scenario_ids:
            scenario = scenarios_by_id.get(sid)
            if scenario and scenario.name:
                scenario_titles.append(scenario.name)

    # Get cohort names
    cohort_names: list[str] = []
    if raw.cohort_id:
        cohort = cohorts_by_id.get(raw.cohort_id)
        if cohort and cohort.name:
            cohort_names.append(cohort.name)

    # Compute time limit from scenarios
    time_limit = _compute_time_limit(raw.scenario_ids, time_limits_by_scenario)

    # Compute pass_pct from rubric points
    pass_pct = compute_pass_pct(raw.rubric_total_points, raw.rubric_pass_points)

    # Compute score_status using pass threshold
    score_status = compute_score_status(raw.score_percent, pass_threshold)

    # Compute score (round score_percent)
    score = round(raw.score_percent) if raw.score_percent is not None else None

    # For home history, archived is always False (MV filters out archived)
    is_archived = False

    # Compute show_view and show_continue
    show_view = compute_show_view(is_archived)

    # For show_continue, we need to compute num_incomplete_chats
    num_incomplete_chats = (raw.num_chats or 0) - (raw.num_chats_completed or 0)
    show_continue = compute_show_continue(
        is_archived=is_archived,
        infinite_mode=raw.infinite_mode,
        num_scenarios=raw.num_scenarios,
        num_scenarios_completed=raw.num_scenarios_completed,
        time_limit_seconds=time_limit,
        elapsed_seconds=raw.total_time_seconds,
        num_incomplete_chats=num_incomplete_chats,
    )

    return HistoryAttempt(
        attempt_id=raw.attempt_id,
        date=raw.attempt_created_at.isoformat() if raw.attempt_created_at else None,
        profile_id=raw.profile_id,
        profile_name=profile_name,
        simulation_name=sim_name,
        num_scenarios=raw.num_scenarios,
        num_scenarios_completed=raw.num_scenarios_completed,
        infinite_mode=raw.infinite_mode,
        time_limit=time_limit,
        persona_names_junction=persona_names if persona_names else None,
        persona_colors_junction=persona_colors if persona_colors else None,
        score=score,
        score_status=score_status,
        simulation_id=raw.simulation_id,
        scenario_ids=raw.scenario_ids,
        scenario_titles=scenario_titles if scenario_titles else None,
        is_archived=is_archived,
        show_view=show_view,
        show_continue=show_continue,
        practice_simulation=False,  # Always False for home
        pass_pct=pass_pct,
        department_ids=department_ids,
        cohort_names_junction=cohort_names if cohort_names else None,
        practice_scenario_id=None,  # Always None for home
    )


def _filter_by_search(
    attempts: list[HistoryAttempt],
    search: str | None,
) -> list[HistoryAttempt]:
    """Filter attempts by search string.

    Searches in simulation_name, profile_name, scenario_titles.

    Args:
        attempts: List of attempts to filter.
        search: Search string (case-insensitive).

    Returns:
        Filtered list of attempts.
    """
    if not search:
        return attempts

    search_lower = search.lower()
    filtered = []
    for attempt in attempts:
        # Search in simulation name
        if attempt.simulation_name and search_lower in attempt.simulation_name.lower():
            filtered.append(attempt)
            continue
        # Search in profile name
        if attempt.profile_name and search_lower in attempt.profile_name.lower():
            filtered.append(attempt)
            continue
        # Search in scenario titles
        if attempt.scenario_titles:
            for title in attempt.scenario_titles:
                if search_lower in title.lower():
                    filtered.append(attempt)
                    break

    return filtered


def _filter_attempts(
    attempts: list[HistoryAttempt],
    simulation_ids: list[UUID] | None,
    scenario_ids: list[UUID] | None,
    profile_ids: list[UUID] | None,
    infinite_mode: bool | None,
) -> list[HistoryAttempt]:
    """Apply additional filters to attempts.

    Args:
        attempts: List of attempts to filter.
        simulation_ids: Filter by simulation IDs.
        scenario_ids: Filter by scenario IDs.
        profile_ids: Filter by profile IDs.
        infinite_mode: Filter by infinite mode.

    Returns:
        Filtered list of attempts.
    """
    filtered = attempts

    # Filter by simulation_ids
    if simulation_ids:
        sim_set = set(simulation_ids)
        filtered = [a for a in filtered if a.simulation_id in sim_set]

    # Filter by scenario_ids (any match)
    if scenario_ids:
        scen_set = set(scenario_ids)
        filtered = [
            a for a in filtered
            if a.scenario_ids and any(sid in scen_set for sid in a.scenario_ids)
        ]

    # Filter by profile_ids
    if profile_ids:
        prof_set = set(profile_ids)
        filtered = [a for a in filtered if a.profile_id in prof_set]

    # Filter by infinite_mode
    if infinite_mode is not None:
        filtered = [a for a in filtered if a.infinite_mode == infinite_mode]

    return filtered


def _sort_attempts(
    attempts: list[HistoryAttempt],
    sort_by: str | None,
    sort_order: str | None,
) -> list[HistoryAttempt]:
    """Sort attempts by specified field.

    Args:
        attempts: List of attempts to sort.
        sort_by: Field to sort by (default: 'date').
        sort_order: 'asc' or 'desc' (default: 'desc').

    Returns:
        Sorted list of attempts.
    """
    sort_field = sort_by or "date"
    is_desc = (sort_order or "desc").lower() == "desc"

    def get_sort_key(attempt: HistoryAttempt) -> Any:
        if sort_field == "date":
            return attempt.date or ""
        elif sort_field == "score":
            return attempt.score if attempt.score is not None else -1
        elif sort_field == "simulation_name":
            return (attempt.simulation_name or "").lower()
        elif sort_field == "profile_name":
            return (attempt.profile_name or "").lower()
        else:
            return attempt.date or ""

    return sorted(attempts, key=get_sort_key, reverse=is_desc)


def _paginate(
    items: list[HistoryAttempt],
    page: int | None,
    page_size: int | None,
) -> tuple[list[HistoryAttempt], int, int]:
    """Paginate a list of items.

    Args:
        items: List of items to paginate.
        page: Page number (0-indexed).
        page_size: Items per page.

    Returns:
        Tuple of (paginated items, total count, total pages).
    """
    p = page if page is not None else 0
    ps = page_size if page_size is not None else 20

    total_count = len(items)
    total_pages = (total_count + ps - 1) // ps if ps > 0 else 0

    start = p * ps
    end = start + ps
    paginated = items[start:end]

    return paginated, total_count, total_pages


def _build_filter_options(
    attempts: list[HistoryAttempt],
    simulations_by_id: dict[UUID, Any],
    profiles_by_id: dict[UUID, Any],
    scenarios_by_id: dict[UUID, Any],
) -> tuple[list[FilterOption], list[FilterOption], list[FilterOption]]:
    """Build filter options from attempts.

    Args:
        attempts: List of all attempts (before pagination).
        simulations_by_id: Simulation metadata lookup.
        profiles_by_id: Profile metadata lookup.
        scenarios_by_id: Scenario metadata lookup.

    Returns:
        Tuple of (profile_options, simulation_options, scenario_options).
    """
    # Count by profile
    profile_counts: dict[UUID, int] = {}
    for a in attempts:
        if a.profile_id:
            profile_counts[a.profile_id] = profile_counts.get(a.profile_id, 0) + 1

    profile_options = [
        FilterOption(
            value=str(pid),
            label=profiles_by_id[pid].name if pid in profiles_by_id else str(pid),
            count=count,
        )
        for pid, count in sorted(profile_counts.items(), key=lambda x: -x[1])
    ]

    # Count by simulation
    sim_counts: dict[UUID, int] = {}
    for a in attempts:
        if a.simulation_id:
            sim_counts[a.simulation_id] = sim_counts.get(a.simulation_id, 0) + 1

    simulation_options = [
        FilterOption(
            value=str(sid),
            label=simulations_by_id[sid].name if sid in simulations_by_id else str(sid),
            count=count,
        )
        for sid, count in sorted(sim_counts.items(), key=lambda x: -x[1])
    ]

    # Count by scenario (unique scenarios across all attempts)
    scenario_counts: dict[UUID, int] = {}
    for a in attempts:
        if a.scenario_ids:
            for sid in a.scenario_ids:
                scenario_counts[sid] = scenario_counts.get(sid, 0) + 1

    scenario_options = [
        FilterOption(
            value=str(sid),
            label=scenarios_by_id[sid].name if sid in scenarios_by_id else str(sid),
            count=count,
        )
        for sid, count in sorted(scenario_counts.items(), key=lambda x: -x[1])
    ]

    return profile_options, simulation_options, scenario_options


@router.post(
    "/list",
    response_model=GetHomeHistoryNewResponse,
    dependencies=[
        audit_activity("home.new.list", "{{ actor.name }} viewed new home history")
    ],
)
async def home_list(
    request: GetHomeHistoryNewClientRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeHistoryNewResponse:
    """Get paginated home history with attempts.

    Uses two-pass pattern:
    1. Context query for user info, permissions, and pass threshold
    2. Data query for raw attempts + metadata
    3. Python handles: search, filters, sort, pagination, computed fields
    """
    tags = ["home", "new", "history"]

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
            return GetHomeHistoryNewResponse.model_validate(cached["data"])

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

        # === QUERY 2: Data (raw attempts + metadata) ===
        # SQL only filters by date range, profile_id, cohort_ids, department_ids
        request_dict = request.model_dump(mode="json")
        data_params = GetHomeHistoryNewSqlParams(
            start_date=request_dict["start_date"],
            end_date=request_dict["end_date"],
            profile_id=profile_id,
            cohort_ids=request_dict.get("cohort_ids"),
            department_ids=request_dict.get("department_ids"),
        )
        sql_params = data_params.to_tuple()

        data = cast(
            GetHomeHistoryNewSqlRow,
            await execute_sql_typed(conn, DATA_SQL_PATH, params=data_params),
        )

        # Set audit context
        if context.actor_name:
            audit_set(
                http_request, actor={"name": context.actor_name, "id": profile_id}
            )

        # === BUILD METADATA LOOKUPS ===
        (
            simulations_by_id,
            profiles_by_id,
            personas_by_id,
            scenarios_by_id,
            time_limits_by_scenario,
        ) = _build_metadata_lookups(data)

        # Also need cohorts_by_id for transformation
        cohorts_by_id: dict[UUID, Any] = {}
        if data.cohorts:
            for cohort in data.cohorts:
                if cohort.cohort_id:
                    cohorts_by_id[cohort.cohort_id] = cohort

        # === TRANSFORM RAW ATTEMPTS ===
        attempts: list[HistoryAttempt] = []
        if data.raw_attempts:
            for raw in data.raw_attempts:
                attempt = _transform_raw_attempt(
                    raw,
                    context.pass_threshold,
                    simulations_by_id,
                    profiles_by_id,
                    personas_by_id,
                    scenarios_by_id,
                    cohorts_by_id,
                    time_limits_by_scenario,
                )
                attempts.append(attempt)

        # === PYTHON FILTERING ===
        # Apply search filter
        attempts = _filter_by_search(attempts, request.search)

        # Apply additional filters
        attempts = _filter_attempts(
            attempts,
            simulation_ids=request.simulation_ids,
            scenario_ids=request.scenario_ids,
            profile_ids=request.profile_ids,
            infinite_mode=request.infinite_mode,
        )

        # === BUILD FILTER OPTIONS (before pagination) ===
        profile_options, simulation_options, scenario_options = _build_filter_options(
            attempts, simulations_by_id, profiles_by_id, scenarios_by_id
        )

        # === SORTING ===
        attempts = _sort_attempts(attempts, request.sort_by, request.sort_order)

        # === PAGINATION ===
        paginated_attempts, total_count, total_pages = _paginate(
            attempts, request.page, request.page_size
        )

        # === BUILD RESPONSE ===
        api_response = GetHomeHistoryNewResponse(
            actor_name=context.actor_name,
            data=paginated_attempts,
            total_count=total_count,
            page=request.page or 0,
            page_size=request.page_size or 20,
            total_pages=total_pages,
            profile_options=profile_options,
            simulation_options=simulation_options,
            scenario_options_junction=scenario_options,
        )

        # Cache response with profile-specific tags
        profile_specific_tags = tags + [
            f"home:profile:{profile_id}",
            f"history:profile:{profile_id}",
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
            operation="home_new_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
