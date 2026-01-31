"""Practice history endpoint - POST /practice/list.

Uses two-pass pattern:
1. Query 1 (Context): Fetch user context and pass_threshold
2. Query 2 (Data): Fetch filtered, sorted, paginated data with all JOINs in SQL
3. Python Business Logic: Compute derived fields (score_status, show_view, show_continue, pass_pct)

SQL handles: filtering, sorting, pagination, all JOINs for metadata
Python handles: only business logic computations
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.analytics.NEW.practice.permissions import (
    compute_pass_pct,
    compute_score_status,
    compute_show_continue,
    compute_show_view,
)
from app.api.v4.analytics.NEW.practice.types import (
    FilterOption,
    GetPracticeHistoryNewClientRequest,
    GetPracticeHistoryNewResponse,
    PracticeHistoryAttempt,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPracticeContextSqlParams,
    GetPracticeContextSqlRow,
    GetPracticeHistoryNewSqlParams,
    GetPracticeHistoryNewSqlRow,
    QGetPracticeHistoryNewV4Attempt,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

CONTEXT_SQL_PATH = (
    "app/sql/v4/queries/analytics/NEW/practice/get_practice_context_complete.sql"
)
DATA_SQL_PATH = (
    "app/sql/v4/queries/analytics/NEW/practice/get_practice_history_new_complete.sql"
)

router = APIRouter()


def _transform_attempt(
    attempt: QGetPracticeHistoryNewV4Attempt,
    pass_threshold: float | None,
) -> PracticeHistoryAttempt:
    """Transform SQL attempt to API response.

    SQL has already JOINed all metadata (names, colors, titles).
    Python only computes derived business logic fields.

    Args:
        attempt: Attempt data from SQL with metadata already JOINed.
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

    # Get is_archived from attempt
    is_archived = attempt.is_archived or False

    # Compute show_view and show_continue
    show_view = compute_show_view(is_archived)

    num_incomplete_chats = (attempt.num_chats or 0) - (attempt.num_chats_completed or 0)
    show_continue = compute_show_continue(
        is_archived=is_archived,
        infinite_mode=attempt.infinite_mode,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        time_limit_seconds=attempt.time_limit_seconds,
        elapsed_seconds=attempt.total_time_seconds,
        num_incomplete_chats=num_incomplete_chats,
    )

    # Convert department_ids to strings
    department_ids = (
        [str(d) for d in attempt.department_ids] if attempt.department_ids else None
    )

    # Convert cohort_name to list for cohort_names_junction
    cohort_names = [attempt.cohort_name] if attempt.cohort_name else None

    # attempt_id should never be None, but handle it gracefully
    if not attempt.attempt_id:
        raise ValueError("attempt_id is required")

    return PracticeHistoryAttempt(
        attempt_id=attempt.attempt_id,
        date=attempt.attempt_created_at.isoformat()
        if attempt.attempt_created_at
        else None,
        profile_id=attempt.profile_id,
        profile_name=attempt.profile_name,
        simulation_id=attempt.simulation_id,
        simulation_name=attempt.simulation_name,
        num_scenarios=attempt.num_scenarios,
        num_scenarios_completed=attempt.num_scenarios_completed,
        infinite_mode=attempt.infinite_mode,
        time_limit=attempt.time_limit_seconds,
        persona_names_junction=attempt.persona_names,
        persona_colors_junction=attempt.persona_colors,
        scenario_ids=attempt.scenario_ids,
        scenario_titles=attempt.scenario_titles,
        department_ids=department_ids,
        cohort_names_junction=cohort_names,
        is_archived=is_archived,
        score=score,
        score_status=score_status,
        pass_pct=pass_pct,
        show_view=show_view,
        show_continue=show_continue,
        practice_simulation=attempt.practice_simulation or True,
        practice_scenario_id=attempt.practice_scenario_id,
    )


@router.post(
    "/list",
    response_model=GetPracticeHistoryNewResponse,
    dependencies=[
        audit_activity(
            "practice.new.list", "{{ actor.name }} viewed new practice history"
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

    SQL handles: filtering, sorting, pagination, all metadata JOINs
    Python handles: only business logic (score_status, show_view, show_continue, pass_pct)
    """
    tags = ["practice", "new", "history"]

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
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # === QUERY 1: Context (for pass_threshold) ===
        context_params = GetPracticeContextSqlParams(profile_id=profile_id)
        context = cast(
            GetPracticeContextSqlRow,
            await execute_sql_typed(conn, CONTEXT_SQL_PATH, params=context_params),
        )

        # === QUERY 2: Data (filtered, sorted, paginated, JOINed in SQL) ===
        request_dict = request.model_dump(mode="json")
        data_params = GetPracticeHistoryNewSqlParams(
            start_date=request_dict["start_date"],
            end_date=request_dict["end_date"],
            profile_id=profile_id,
            cohort_ids=request_dict.get("cohort_ids"),
            department_ids=request_dict.get("department_ids"),
            simulation_ids=request_dict.get("simulation_ids"),
            scenario_ids=request_dict.get("scenario_ids"),
            profile_ids=request_dict.get("profile_ids"),
            infinite_mode=request_dict.get("infinite_mode"),
            show_archived=request_dict.get("show_archived", False),
            search=request_dict.get("search"),
            sort_by=request_dict.get("sort_by"),
            sort_order=request_dict.get("sort_order"),
            page=request_dict.get("page", 0),
            page_size=request_dict.get("page_size", 20),
        )
        sql_params = data_params.to_tuple()

        data = cast(
            GetPracticeHistoryNewSqlRow,
            await execute_sql_typed(conn, DATA_SQL_PATH, params=data_params),
        )

        # Set audit context
        if context.actor_name:
            audit_set(
                http_request, actor={"name": context.actor_name, "id": profile_id}
            )

        # === TRANSFORM: Only compute business logic fields ===
        attempts: list[PracticeHistoryAttempt] = []
        if data.attempts:
            for attempt in data.attempts:
                attempts.append(_transform_attempt(attempt, context.pass_threshold))

        # === CONVERT FILTER OPTIONS ===
        simulation_options = None
        if data.simulation_options:
            simulation_options = [
                FilterOption(value=opt.value or "", label=opt.label, count=opt.count)
                for opt in data.simulation_options
                if opt.value
            ]

        scenario_options = None
        if data.scenario_options:
            scenario_options = [
                FilterOption(value=opt.value or "", label=opt.label, count=opt.count)
                for opt in data.scenario_options
                if opt.value
            ]

        profile_options = None
        if data.profile_options:
            profile_options = [
                FilterOption(value=opt.value or "", label=opt.label, count=opt.count)
                for opt in data.profile_options
                if opt.value
            ]

        # === COMPUTE PAGINATION INFO ===
        total_count = data.total_count or 0
        page = request.page or 0
        page_size = request.page_size or 20
        total_pages = (
            (total_count + page_size - 1) // page_size if page_size > 0 else 0
        )

        # === BUILD RESPONSE ===
        api_response = GetPracticeHistoryNewResponse(
            actor_name=context.actor_name,
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
            operation="practice_new_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
