"""Reports overview v3 API endpoint - requires profileId for individual reports."""

import json
from datetime import datetime
from enum import Enum
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.sql.types import GetDashboardBundleApiResponse
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached


# Inline mapping types (DHH style - no shared types)
class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


from utils.sql_helper import load_sql

router = APIRouter()


# Inline filter schemas
class ReportsOverviewFilters(BaseModel):
    """Reports overview filter request schema - requires profileId for individual reports."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    # profileId removed - comes from X-Profile-Id header
    departmentIds: list[str] | None = None


@router.post(
    "/overview",
    response_model=GetDashboardBundleApiResponse,
    dependencies=[
        audit_activity("reports.overview", "{{ actor.name }} viewed reports overview")
    ],
)
async def get_reports_overview(
    filters: ReportsOverviewFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDashboardBundleApiResponse:
    """Get complete reports overview bundle for individual profile - requires profileId."""
    tags = ["reports", "overview"]

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetDashboardBundleApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/reports/overview.sql")

        # Build parameters in the same order as the query expects ($1-$7)
        # $1-$2: dates, $3: cohort_ids, $4: roles, $5: sim_filters, $6: profile_id (from header), $7: department_ids
        start_dt = datetime.fromisoformat(filters.startDate.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(filters.endDate.replace("Z", "+00:00"))
        cohort_ids = filters.cohortIds or []
        roles = filters.roles or []
        sim_filters = (
            [
                f.value if isinstance(f, SimulationFilter) else f
                for f in filters.simulationFilters
            ]
            if filters.simulationFilters
            else ["general"]
        )
        department_ids = filters.departmentIds or []

        sql_params = (
            start_dt,
            end_dt,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        # JIT compilation overhead can be significant for large JSONB aggregation queries
        # Using SET LOCAL in a transaction so it only affects this query
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            # Execute query within the same transaction
            result = await conn.fetchrow(sql_query, *sql_params)

        # Handle empty results gracefully - return empty structure instead of error
        # The SQL should always return a row, but handle edge case where it doesn't
        if not result or not result.get("result"):
            # Create empty data structure - parsing function will handle defaults
            data = {}
        else:
            # Parse JSONB result (may be string or dict)
            data = result["result"]
            if isinstance(data, str):
                data = json.loads(data)
            # Ensure data is a dict (handle case where result is None or empty)
            if not isinstance(data, dict):
                data = {}

        # TODO: Reports endpoint should be migrated to use execute_sql_typed() like dashboard bundle
        # For now, use the data directly (reports endpoint uses manual SQL with JSONB parsing)
        # This is a temporary workaround - reports endpoint needs full migration
        response_data = GetDashboardBundleApiResponse.model_validate(data) if data else GetDashboardBundleApiResponse.model_validate({})

        # Fetch actor_name separately
        actor_name_row = await conn.fetchrow(
            "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
            profile_id,
        )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(request, actor={"name": actor_name, "id": profile_id})

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_reports_overview",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
