"""Home history endpoint - POST /home/list.

Uses two-pass pattern:
1. Query 1 (Context): Fetch user context, permissions, and settings
2. Python Business Logic: Compute mode from user role
3. Query 2 (Data): Fetch paginated data using mode and accessible cohorts
4. Python Post-Processing: Compute score_status for each attempt
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.analytics.NEW.home.permissions import compute_mode, compute_score_status
from app.api.v4.analytics.NEW.home.types import GetHomeHistoryNewClientRequest
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetHomeContextSqlParams,
    GetHomeContextSqlRow,
    GetHomeHistoryNewApiResponse,
    GetHomeHistoryNewSqlParams,
    GetHomeHistoryNewSqlRow,
    QGetHomeHistoryNewV4Attempt,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

CONTEXT_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_context_complete.sql"
DATA_SQL_PATH = "app/sql/v4/queries/analytics/NEW/home/get_home_history_new_complete.sql"

router = APIRouter()


def _enrich_attempt_with_score_status(
    attempt: QGetHomeHistoryNewV4Attempt,
    pass_threshold: float | None,
) -> dict[str, Any]:
    """Add score_status to an attempt record.

    The SQL computes score_status, but Python can override it using the
    pass threshold from context for flexibility.

    Args:
        attempt: The attempt record from SQL.
        pass_threshold: The pass threshold from context (default 70).

    Returns:
        Dict with all attempt fields plus computed score_status.
    """
    attempt_dict = attempt.model_dump()
    # Override SQL-computed score_status with Python-computed value
    # using pass threshold from context
    attempt_dict["score_status"] = compute_score_status(
        attempt.score, pass_threshold
    )
    return attempt_dict


@router.post(
    "/list",
    response_model=GetHomeHistoryNewApiResponse,
    dependencies=[
        audit_activity("home.new.list", "{{ actor.name }} viewed new home history")
    ],
)
async def home_list(
    request: GetHomeHistoryNewClientRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHomeHistoryNewApiResponse:
    """Get paginated home history with attempts.

    Uses two-pass pattern:
    1. Context query for user info, permissions, and pass threshold
    2. Data query with mode and accessible cohorts for filtering
    3. Python computes score_status for each attempt using pass threshold
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
            return GetHomeHistoryNewApiResponse.model_validate(cached["data"])

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

        # === PYTHON BUSINESS LOGIC ===
        mode = compute_mode(context.user_role)

        # === QUERY 2: Data with pagination ===
        # Pass mode and accessible_cohort_ids to SQL for filtering
        request_dict = request.model_dump(mode="json")
        data_params = GetHomeHistoryNewSqlParams(
            start_date=request_dict["start_date"],
            end_date=request_dict["end_date"],
            profile_id=profile_id,
            mode=mode,  # Computed from context
            accessible_cohort_ids=context.accessible_cohort_ids or [],  # From context
            cohort_ids=request_dict.get("cohort_ids"),
            department_ids=request_dict.get("department_ids"),
            roles=request_dict.get("roles"),
            simulation_filters=request_dict.get("simulation_filters"),
            search=request_dict.get("search"),
            profile_ids=request_dict.get("profile_ids"),
            simulation_ids=request_dict.get("simulation_ids"),
            scenario_ids=request_dict.get("scenario_ids"),
            infinite_mode=request_dict.get("infinite_mode"),
            sort_by=request_dict.get("sort_by"),
            sort_order=request_dict.get("sort_order"),
            page=request_dict.get("page", 0),
            page_size=request_dict.get("page_size", 20),
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

        # === PYTHON POST-PROCESSING ===
        # Compute score_status for each attempt using pass threshold from context
        enriched_data = None
        if data.data:
            enriched_data = [
                _enrich_attempt_with_score_status(attempt, context.pass_threshold)
                for attempt in data.data
            ]

        # === BUILD RESPONSE ===
        api_response = GetHomeHistoryNewApiResponse(
            actor_name=context.actor_name,
            data=enriched_data,  # type: ignore[arg-type]
            total_count=data.total_count,
            page=data.page,
            page_size=data.page_size,
            total_pages=data.total_pages,
            profile_options=data.profile_options,
            simulation_options=data.simulation_options,
            scenario_options_junction=data.scenario_options_junction,
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
