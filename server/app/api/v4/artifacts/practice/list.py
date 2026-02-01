"""Practice history endpoint - POST /practice/list.

Uses simulation history view internal handler for data fetching.
Python handles business logic: score_status, show_view, show_continue, pass_pct.
"""

from datetime import datetime
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.practice.permissions import (
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
)
from app.api.v4.artifacts.practice.types import (
    FilterOption,
    GetPracticeHistoryNewClientRequest,
    GetPracticeHistoryNewResponse,
    PracticeHistoryAttempt,
)
from app.api.v4.views.simulation.history.get import get_simulation_history_internal
from app.api.v4.views.simulation.history.types import HistoryViewItem
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


def _transform_attempt(
    attempt: HistoryViewItem,
    pass_threshold: float | None,
) -> PracticeHistoryAttempt:
    """Transform history view item to API response.

    Python only computes derived business logic fields.

    Args:
        attempt: History view item with metadata already JOINed.
        pass_threshold: Pass threshold from context for score classification.

    Returns:
        PracticeHistoryAttempt ready for API response.
    """
    # === PYTHON BUSINESS LOGIC: Compute derived fields ===

    # Compute pass_pct from rubric points
    pass_pct = compute_pass_pct(attempt.rubric_total_points, attempt.rubric_pass_points)

    # Compute score_status using pass threshold
    score_status = compute_score_status(attempt.score_percent, pass_threshold)

    # Compute score (round score_percent)
    score = round(attempt.score_percent) if attempt.score_percent is not None else None

    # Get is_archived from the attempt
    is_archived = attempt.is_archived

    # Compute show_view and show_continue
    show_view = compute_show_view(is_archived)

    num_incomplete_chats = (attempt.num_chats or 0) - (attempt.num_chats_completed or 0)
    show_continue = compute_show_continue(
        is_archived=is_archived,
        infinite_mode=attempt.infinite_mode,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        time_limit_seconds=attempt.time_limit,
        elapsed_seconds=attempt.total_time_seconds,
        num_incomplete_chats=num_incomplete_chats,
    )

    # Convert department_ids to strings
    department_ids = (
        [str(d) for d in attempt.department_ids] if attempt.department_ids else None
    )

    # Convert cohort_name to list for cohort_names_junction
    cohort_names = [attempt.cohort_name] if attempt.cohort_name else None

    # Derive practice_scenario_id from scenario_ids (first one if available)
    practice_scenario_id = attempt.scenario_ids[0] if attempt.scenario_ids else None

    return PracticeHistoryAttempt(
        attempt_id=attempt.attempt_id,
        date=attempt.attempt_created_at.isoformat() if attempt.attempt_created_at else None,
        profile_id=attempt.profile_id,
        profile_name=attempt.profile_name,
        simulation_id=attempt.simulation_id,
        simulation_name=attempt.simulation_name,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        infinite_mode=attempt.infinite_mode,
        time_limit=attempt.time_limit,
        persona_names_junction=attempt.persona_names,
        persona_colors_junction=attempt.persona_colors,
        scenario_ids=attempt.scenario_ids,
        scenario_titles=attempt.scenario_names,  # scenario_names maps to scenario_titles
        department_ids=department_ids,
        cohort_names_junction=cohort_names,
        is_archived=is_archived,
        score=score,
        score_status=score_status,
        pass_pct=pass_pct,
        show_view=show_view,
        show_continue=show_continue,
        practice_simulation=True,  # Always True for practice
        practice_scenario_id=practice_scenario_id,
    )


@router.post(
    "/list",
    response_model=GetPracticeHistoryNewResponse,
    dependencies=[
        audit_activity(
            "practice.list", "{{ actor.name }} viewed practice history"
        )
    ],
)
async def practice_list(
    request: GetPracticeHistoryNewClientRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPracticeHistoryNewResponse:
    """Get paginated practice history with attempts.

    Uses simulation history view internal handler for data.
    Python handles only business logic (score_status, show_view, show_continue, pass_pct).
    """
    tags = ["practice", "history"]

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
            return GetPracticeHistoryNewResponse.model_validate(cached["data"])

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

        # Parse dates
        date_from = datetime.fromisoformat(request.start_date) if request.start_date else None
        date_to = datetime.fromisoformat(request.end_date) if request.end_date else None

        # Compute page offset from page number
        page = request.page or 0
        page_size = request.page_size or 20
        page_offset = page * page_size

        # === FETCH DATA FROM VIEW INTERNAL HANDLER ===
        history_result = await get_simulation_history_internal(
            conn=conn,
            profile_id=resource_id,
            simulation_ids=request.simulation_ids,
            cohort_ids=request.cohort_ids,
            department_ids=request.department_ids,
            practice=True,  # Practice mode
            date_from=date_from,
            date_to=date_to,
            scenario_ids=request.scenario_ids,
            infinite_mode=request.infinite_mode,
            search=request.search,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            page_limit=page_size,
            page_offset=page_offset,
            profile_ids=request.profile_ids,
            show_archived=request.show_archived or False,
            bypass_cache=bypass_cache,
        )

        # === TRANSFORM: Only compute business logic fields ===
        attempts: list[PracticeHistoryAttempt] = []
        for attempt in history_result.items:
            attempts.append(_transform_attempt(attempt, context.pass_threshold))

        # === CONVERT FILTER OPTIONS ===
        simulation_options = None
        if history_result.simulation_options:
            simulation_options = [
                FilterOption(value=opt.value, label=opt.label, count=opt.count)
                for opt in history_result.simulation_options
            ]

        scenario_options = None
        if history_result.scenario_options:
            scenario_options = [
                FilterOption(value=opt.value, label=opt.label, count=opt.count)
                for opt in history_result.scenario_options
            ]

        profile_options = None
        if history_result.profile_options:
            profile_options = [
                FilterOption(value=opt.value, label=opt.label, count=opt.count)
                for opt in history_result.profile_options
            ]

        # === COMPUTE PAGINATION INFO ===
        total_count = history_result.total_count
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

        # === BUILD RESPONSE ===
        api_response = GetPracticeHistoryNewResponse(
            actor_name=history_result.actor_name or context.actor_name,
            data=attempts,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            simulation_options=simulation_options,
            scenario_options=scenario_options,
            profile_options=profile_options,
        )

        # Cache response
        profile_specific_tags = tags + [
            f"practice:profile:{profile_id}",
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
            operation="practice_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
