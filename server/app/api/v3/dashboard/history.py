"""Dashboard history endpoint - POST /dashboard/history"""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error


# Inline mapping types (DHH style - no shared types)
class AttemptHistoryRow(BaseModel):
    """Attempt history row - shared across dashboard, home, reports, and practice history endpoints."""

    model_config = ConfigDict(populate_by_name=True)

    attemptId: str
    date: str
    profileId: str
    profileName: str
    simulationName: str
    numScenarios: int | None = None
    numScenariosCompleted: int
    infiniteMode: bool
    timeLimit: int | None = None
    personaNames: list[str]
    personaColors: list[str]
    score: int | None = None
    scoreStatus: str | None = None  # "high" | "medium" | "low" | None
    simulation_id: str
    scenario_ids: list[str]
    scenario_titles: list[str]
    isArchived: bool
    showView: bool
    showContinue: bool
    practiceSimulation: bool
    passPct: int | None = None
    department_ids: list[str] | None = None
    cohortNames: list[str]
    practiceScenarioId: str | None = None


from utils.sql_helper import load_sql

router = APIRouter()


class DashboardHistoryFilters(BaseModel):
    """Dashboard history filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    departmentIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[str] | None = None  # ["general", "practice", "archived"]
    page: int = 0
    pageSize: int = 20
    search: str | None = None
    profileIds: list[str] | None = None
    simulationIds: list[str] | None = None
    scenarioIds: list[str] | None = None
    infiniteMode: bool | None = None
    sortBy: str = "date"
    sortOrder: str = "desc"


class DashboardHistoryResponse(BaseModel):
    """Dashboard history paginated response."""

    data: list[AttemptHistoryRow]
    totalCount: int
    archivedCount: int
    unarchivedCount: int
    page: int
    pageSize: int
    totalPages: int
    # UI-ready facet options (precomputed on server)
    profileOptions: list[
        dict[str, str | int]
    ]  # Array of {value: profileId, label: profileName, count: int}
    simulationOptions: list[
        dict[str, str | int]
    ]  # Array of {value: simulationId, label: simulationName, count: int}
    scenarioOptions: list[
        dict[str, str | int]
    ]  # Array of {value: scenarioId, label: scenarioTitle, count: int}


@router.post(
    "/history",
    response_model=DashboardHistoryResponse,
    dependencies=[
        audit_activity("dashboard.history", "{{ actor.name }} viewed dashboard history")
    ],
)
async def get_dashboard_history(
    filters: DashboardHistoryFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardHistoryResponse:
    """Get paginated dashboard history with search, filters, sorting, and pagination."""
    tags = ["dashboard", "history"]

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
            return DashboardHistoryResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = request.state.profile_id

        # Load SQL query
        sql_query = load_sql("app/sql/v3/dashboard/history.sql")

        # Build parameter list matching SQL file expectations:
        # $1, $2: dates (for WHERE clause)
        # $3: cohort_ids
        # $4: department_ids
        # $5: roles (scoped roles from filters)
        # $6: simulationFilters (text[], optional)
        # $7: search (text, optional)
        # $8: profileIds filter (uuid[], optional)
        # $9: simulationIds filter (uuid[], optional)
        # $10: scenarioIds filter (uuid[], optional)
        # $11: infiniteMode filter (bool, optional)
        # $12: sortBy (text)
        # $13: sortOrder (text)
        # $14: pageSize (int, LIMIT)
        # $15: offset (int, OFFSET)
        from datetime import datetime

        roles = filters.roles if filters.roles else []
        simulation_filters = (
            filters.simulationFilters if filters.simulationFilters else ["general"]
        )
        params = [
            datetime.fromisoformat(filters.startDate.replace("Z", "+00:00")),  # $1
            datetime.fromisoformat(filters.endDate.replace("Z", "+00:00")),  # $2
            filters.cohortIds if filters.cohortIds else [],  # $3
            filters.departmentIds if filters.departmentIds else [],  # $4
            roles,  # $5
            simulation_filters,  # $6
            filters.search if filters.search else None,  # $7
            filters.profileIds if filters.profileIds else [],  # $8
            filters.simulationIds if filters.simulationIds else [],  # $9
            filters.scenarioIds if filters.scenarioIds else [],  # $10
            filters.infiniteMode,  # $11 (can be None)
            filters.sortBy,  # $12
            filters.sortOrder,  # $13
            filters.pageSize,  # $14
            filters.page * filters.pageSize,  # $15 (OFFSET)
        ]
        sql_params = tuple(params)

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            result = await conn.fetchrow(sql_query, *params)
        # Parse JSON result
        parsed_result = (
            json.loads(result["result"])
            if isinstance(result["result"], str)
            else result["result"]
        )

        # Parse history data
        history = []
        if isinstance(parsed_result.get("data"), list):
            for row in parsed_result["data"]:
                if isinstance(row, dict):
                    # Filter out None values from scenario_ids and scenario_titles arrays
                    if "scenario_ids" in row and isinstance(row["scenario_ids"], list):
                        row["scenario_ids"] = [
                            s for s in row["scenario_ids"] if s is not None
                        ]
                    if "scenario_titles" in row and isinstance(
                        row["scenario_titles"], list
                    ):
                        row["scenario_titles"] = [
                            s for s in row["scenario_titles"] if s is not None
                        ]
                    history.append(AttemptHistoryRow.model_validate(row))

        # Parse options from result
        profile_options = parsed_result.get("profileOptions", [])
        simulation_options = parsed_result.get("simulationOptions", [])
        scenario_options = parsed_result.get("scenarioOptions", [])

        # Ensure options are lists of dicts with value/label structure
        if not isinstance(profile_options, list):
            profile_options = []
        if not isinstance(simulation_options, list):
            simulation_options = []
        if not isinstance(scenario_options, list):
            scenario_options = []

        total_count = parsed_result.get("totalCount", 0)
        archived_count = parsed_result.get("archivedCount", 0)
        unarchived_count = parsed_result.get("unarchivedCount", 0)
        total_pages = (
            (total_count + filters.pageSize - 1) // filters.pageSize
            if total_count > 0
            else 0
        )

        response_data = DashboardHistoryResponse(
            data=history,
            totalCount=total_count,
            archivedCount=archived_count,
            unarchivedCount=unarchived_count,
            page=filters.page,
            pageSize=filters.pageSize,
            totalPages=total_pages,
            profileOptions=profile_options,
            simulationOptions=simulation_options,
            scenarioOptions=scenario_options,
        )

        # Fetch actor_name separately
        actor_name = None
        if profile_id:
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
            operation="get_dashboard_history",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
