"""Cohort list endpoint - v4 API."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.types import (
    ListCohortApiCohort,
    ListCohortApiResponse,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetCohortsListApiRequest,
    GetCohortsListSqlParams,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/cohorts/get_cohorts_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListCohortApiResponse,
    dependencies=[
        audit_activity("cohorts.list", "{{ actor.name }} visited the Cohorts page")
    ],
)
async def get_cohort_list(
    request: GetCohortsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListCohortApiResponse:
    """Get cohorts list with permissions and relationships."""
    tags = ["cohorts"]  # From router tags

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (mode='json' to serialize UUIDs)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListCohortApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        params = GetCohortsListSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        )

        # Get actor name and user_role from SQL result
        actor_name = result.actor_name
        user_role = getattr(result, "user_role", "member") or "member"

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Convert raw SQL cohorts to API cohorts (permissions already computed in SQL)
        api_cohorts: list[ListCohortApiCohort] = []
        for sql_cohort in result.cohorts or []:
            if hasattr(sql_cohort, "model_dump"):
                api_cohorts.append(
                    ListCohortApiCohort.model_validate(sql_cohort.model_dump())
                )
            else:
                api_cohorts.append(ListCohortApiCohort.model_validate(sql_cohort))

        def _normalize_list(items: list[Any] | None) -> list[dict[str, Any]] | None:
            if not items:
                return []
            normalized: list[dict[str, Any]] = []
            for item in items:
                if hasattr(item, "model_dump"):
                    normalized.append(item.model_dump())
                else:
                    normalized.append(dict(item))
            return normalized

        # Build API response
        api_response = ListCohortApiResponse(
            actor_name=actor_name,
            user_role=user_role,
            cohorts=api_cohorts,
            profiles=_normalize_list(result.profiles),
            simulations=_normalize_list(result.simulations),
            departments=_normalize_list(result.departments),
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohort_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
