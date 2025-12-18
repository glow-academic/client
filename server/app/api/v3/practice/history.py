"""Practice history endpoint - POST /practice/history"""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


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


router = APIRouter()


class PracticeHistoryFilters(BaseModel):
    """Practice history filter request schema."""

    # profileId removed - comes from X-Profile-Id header
    departmentIds: list[str] | None = None
    page: int = 0
    pageSize: int = 20
    search: str | None = None
    profileIds: list[str] | None = None
    simulationIds: list[str] | None = None
    scenarioIds: list[str] | None = None
    infiniteMode: bool | None = None
    sortBy: str = "date"
    sortOrder: str = "desc"


class PracticeHistoryResponse(BaseModel):
    """Practice history paginated response."""

    data: list[AttemptHistoryRow]
    totalCount: int
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


@router.post("/history", response_model=PracticeHistoryResponse)
async def get_practice_history(
    filters: PracticeHistoryFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PracticeHistoryResponse:
    """Get paginated practice history with search, filters, sorting, and pagination."""
    tags = ["practice", "history"]

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
            return PracticeHistoryResponse.model_validate(cached["data"])

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

        # Profile ID must be a valid UUID (guest profile IDs are resolved on the client side)

        # Load SQL query
        sql_query = load_sql("sql/v3/practice/history.sql")

        # Build parameter list matching SQL file expectations:
        # $1: profile_id
        # $2: department_ids
        # $3: search (text, optional)
        # $4: profileIds filter (uuid[], optional)
        # $5: simulationIds filter (uuid[], optional)
        # $6: scenarioIds filter (uuid[], optional)
        # $7: infiniteMode filter (bool, optional)
        # $8: sortBy (text)
        # $9: sortOrder (text)
        # $10: pageSize (int, LIMIT)
        # $11: offset (int, OFFSET)
        params = [
            profile_id if profile_id else None,  # $1
            filters.departmentIds if filters.departmentIds else [],  # $2
            filters.search if filters.search else None,  # $3
            filters.profileIds if filters.profileIds else [],  # $4
            filters.simulationIds if filters.simulationIds else [],  # $5
            filters.scenarioIds if filters.scenarioIds else [],  # $6
            filters.infiniteMode,  # $7 (can be None)
            filters.sortBy,  # $8
            filters.sortOrder,  # $9
            filters.pageSize,  # $10
            filters.page * filters.pageSize,  # $11 (OFFSET)
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
        total_pages = (
            (total_count + filters.pageSize - 1) // filters.pageSize
            if total_count > 0
            else 0
        )

        response_data = PracticeHistoryResponse(
            data=history,
            totalCount=total_count,
            page=filters.page,
            pageSize=filters.pageSize,
            totalPages=total_pages,
            profileOptions=profile_options,
            simulationOptions=simulation_options,
            scenarioOptions=scenario_options,
        )

        # Cache response with profile-specific tags
        # Add profile-specific tags for granular invalidation
        profile_specific_tags = tags + [
            f"practice:profile:{profile_id}",
            f"history:profile:{profile_id}",
        ]
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=300,
            tags=profile_specific_tags,
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
            operation="get_practice_history",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
