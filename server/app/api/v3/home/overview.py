"""Home overview endpoint - POST /home"""

import json
from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class SimulationMappingItem(BaseModel):
    """Simulation mapping item."""

    name: str
    description: str
    time_limit: int | None = None
    department_ids: list[str] | None = None


class StandardGroupMappingItem(BaseModel):
    """Standard group mapping item with rubric context."""

    name: str
    description: str
    points: int
    passPoints: int


class StandardMappingItem(BaseModel):
    """Standard mapping item with points."""

    name: str
    description: str
    points: int


# Type aliases for Dict mappings
SimulationMapping = dict[str, SimulationMappingItem]
StandardGroupsMapping = dict[str, StandardGroupMappingItem]
StandardsMapping = dict[str, StandardMappingItem]

router = APIRouter()


# Inline schemas
class HomeSimulationItem(BaseModel):
    """Home simulation item."""

    viewMode: Literal["member", "instructional"]
    id: str
    simulationTitle: str
    simulationDescription: str | None = None
    simulationName: str
    timeLimit: int | None = None
    numSessions: int
    highestScore: float | None = None
    standard_groups: dict[str, list[str]]
    color: str | None = None
    icon: str | None = None
    hasPassed: bool | None = None
    passRate: float | None = None
    status: Literal["not-started", "in-progress", "passed"] | None = None
    completionPct: float | None = None
    passedCount: int | None = None
    inProgressCount: int | None = None
    notStartedCount: int | None = None
    passPct: float | None = None
    cohortName: str | None = None
    cohortNames: str | None = None


class AttemptHistoryRow(BaseModel):
    """Attempt history row."""

    attemptId: str
    date: str
    profileId: str
    profileName: str
    simulationName: str
    numScenarios: int | None = None
    numScenariosCompleted: int
    infiniteMode: bool
    timeLimit: int | None = (
        None  # simulation time limit in seconds (from simulation_time_limits)
    )
    personaNames: list[str]
    personaColors: list[str]
    score: int | None = None
    simulation_id: str
    scenario_ids: list[str]
    scenario_titles: list[str]
    isArchived: bool
    showView: bool
    showContinue: bool
    practiceSimulation: bool
    passPct: int | None = None
    department_ids: list[str] | None = None  # Simulation's department associations
    cohortNames: list[str]
    practiceScenarioId: str | None = None


AttemptHistoryResponse = list[AttemptHistoryRow]


class HomeOverviewResponse(BaseModel):
    """Home overview response with mappings and history."""

    mode: Literal["member", "instructional", "empty"]
    hasData: bool
    items: list[HomeSimulationItem]
    history: AttemptHistoryResponse
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    simulation_mapping: SimulationMapping


class HomeFilters(BaseModel):
    """Home filter request schema - always shows general simulations."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    # profileId removed - comes from X-Profile-Id header
    departmentIds: list[str] | None = None


def _parse_json_strings_recursive(obj: Any) -> Any:  # noqa: ANN401
    """Recursively parse JSON strings in nested structures."""
    if isinstance(obj, str):
        try:
            return json.loads(obj)
        except (json.JSONDecodeError, ValueError):
            return obj
    elif isinstance(obj, dict):
        return {k: _parse_json_strings_recursive(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_parse_json_strings_recursive(item) for item in obj]
    else:
        return obj


@router.post(
    "/overview",
    response_model=HomeOverviewResponse,
    dependencies=[
        audit_activity("home.overview", "{{ actor.name }} viewed home overview")
    ],
)
async def get_home_overview(
    filters: HomeFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HomeOverviewResponse:
    """Get home overview with items, history, and mappings.

    Home always shows general simulations only (no simulationFilters parameter).
    """
    tags = ["home"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return HomeOverviewResponse.model_validate(cached["data"])

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

        # Profile ID is required and must be a valid UUID
        # Guest profile IDs are resolved on the client side before calling this endpoint
        # SQL will infer role hierarchy from profileId

        # Load SQL query
        # Note: Home always shows general simulations only (hardcoded in SQL)
        # The SQL file uses $1, $2 (dates) for date filtering
        # Cohort and department filters are handled separately in the SQL via $4, $5
        # Simulation filtering by cohorts is handled via filtered_simulation_ids CTE
        from datetime import datetime

        sql_query = load_sql("app/sql/v3/home/home_overview.sql")

        # Build parameter list matching SQL file expectations:
        # $1, $2: dates (for WHERE clause)
        # $3: profile_id
        # $4: cohort_ids
        # $5: department_ids
        # Roles are now inferred from profileId in SQL (no longer a parameter)
        params = [
            datetime.fromisoformat(filters.startDate.replace("Z", "+00:00")),  # $1
            datetime.fromisoformat(filters.endDate.replace("Z", "+00:00")),  # $2
            profile_id,  # $3 (from header)
            filters.cohortIds if filters.cohortIds else [],  # $4
            filters.departmentIds if filters.departmentIds else [],  # $5
        ]
        sql_params = tuple(params)

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            result = await conn.fetchval(sql_query, *params)

        # Parse JSON result recursively
        parsed_result = _parse_json_strings_recursive(result or {})

        # Parse embedded history
        history = []
        if isinstance(parsed_result.get("history"), list):
            for row in parsed_result["history"]:
                if isinstance(row, dict):
                    history.append(AttemptHistoryRow.model_validate(row))

        # Parse embedded simulation mapping
        simulation_mapping: dict[str, SimulationMappingItem] = {}
        if isinstance(parsed_result.get("simulation_mapping"), dict):
            for sim_id, sim_data in parsed_result["simulation_mapping"].items():
                if isinstance(sim_data, dict):
                    # Handle department_ids - may be array or null
                    dept_ids = sim_data.get("department_ids")
                    if isinstance(dept_ids, str):
                        try:
                            dept_ids = json.loads(dept_ids)
                        except (json.JSONDecodeError, ValueError):
                            dept_ids = [dept_ids] if dept_ids else None
                    elif dept_ids is None:
                        dept_ids = None
                    elif not isinstance(dept_ids, list):
                        dept_ids = [dept_ids] if dept_ids else None

                    simulation_mapping[str(sim_id)] = SimulationMappingItem(
                        name=sim_data.get("name", ""),
                        description=sim_data.get("description", ""),
                        time_limit=sim_data.get("time_limit"),
                        department_ids=dept_ids,
                    )

        response_data = HomeOverviewResponse(
            mode=parsed_result.get("mode", "empty"),
            hasData=parsed_result.get("hasData", False),
            items=parsed_result.get("items", []),
            history=history,
            standard_groups_mapping=parsed_result.get("standard_groups_mapping", {}),
            standards_mapping=parsed_result.get("standards_mapping", {}),
            simulation_mapping=simulation_mapping,  # type: ignore[arg-type]
        )

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
            operation="get_home_overview",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
