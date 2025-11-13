"""Home overview endpoint - POST /home"""

import json
from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (SimulationMapping, SimulationMappingItem,
                              StandardGroupsMapping, StandardsMapping)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter(prefix="/home", tags=["home"])

# Inline schemas
class HomeSimulationItem(BaseModel):
    """Home simulation item."""

    viewMode: Literal["ta", "instructional"]
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


AttemptHistoryResponse = list[AttemptHistoryRow]


class HomeOverviewResponse(BaseModel):
    """Home overview response with mappings and history."""

    mode: Literal["ta", "instructional", "empty"]
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
    profileId: str | None = None
    departmentIds: list[str] | None = None


def _parse_json_strings_recursive(obj: Any) -> Any:
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


@router.post("", response_model=HomeOverviewResponse)
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
    
    try:
        # Resolve "guest-profile-id" to actual default guest profile
        profile_id = filters.profileId
        if profile_id == "guest-profile-id":
            # Get default guest profile
            guest_query = load_sql("sql/v3/profile/get_default_guest_profile.sql")
            guest_row = await conn.fetchrow(guest_query)
            if guest_row:
                profile_id = str(guest_row["id"])
            else:
                raise ValueError("No default guest profile found in database")

        # Build WHERE clause for home overview
        # Note: Home always shows general simulations only (hardcoded)
        # The SQL file expects WHERE clause to use $1, $2 (dates) and simulation filter
        # Cohort and department filters are handled separately in the SQL via $4, $5
        from datetime import datetime
        where_clause = "a.attempt_created_at >= $1 AND a.attempt_created_at < $2 AND a.is_general = TRUE"

        # Load SQL template
        sql_template = load_sql("sql/v3/home/home_overview.sql")

        # Replace WHERE clause placeholder
        query = sql_template.replace("{WHERE_CLAUSE_PLACEHOLDER}", where_clause)

        # Build parameter list matching SQL file expectations:
        # $1, $2: dates (for WHERE clause)
        # $3: profile_id
        # $4: cohort_ids
        # $5: department_ids
        # $6: roles (hardcoded to ["ta"])
        # $7, $8: history dates
        # $9: history_profile_id
        # $10, $11: history cohort_ids, dept_ids
        params = [
            datetime.fromisoformat(filters.startDate.replace("Z", "+00:00")),  # $1
            datetime.fromisoformat(filters.endDate.replace("Z", "+00:00")),  # $2
            profile_id if profile_id else None,  # $3
            filters.cohortIds if filters.cohortIds else [],  # $4
            filters.departmentIds if filters.departmentIds else [],  # $5
            ["ta"],  # $6
            datetime.fromisoformat(filters.startDate.replace("Z", "+00:00")),  # $7
            datetime.fromisoformat(filters.endDate.replace("Z", "+00:00")),  # $8
            profile_id if profile_id else None,  # $9
            filters.cohortIds if filters.cohortIds else [],  # $10
            filters.departmentIds if filters.departmentIds else [],  # $11
        ]

        result = await conn.fetchval(query, *params)

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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

