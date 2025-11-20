"""Home history endpoint - POST /home/history"""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


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
    timeLimit: int | None = None
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
    department_ids: list[str] | None = None
    cohortNames: list[str]
    practiceScenarioId: str | None = None


class HomeHistoryFilters(BaseModel):
    """Home history filter request schema."""

    profileId: str | None = None
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


class HomeHistoryResponse(BaseModel):
    """Home history paginated response."""

    data: list[AttemptHistoryRow]
    totalCount: int
    page: int
    pageSize: int
    totalPages: int
    # UI-ready facet options (precomputed on server)
    profileOptions: list[dict[str, str | int]]  # Array of {value: profileId, label: profileName, count: int}
    simulationOptions: list[dict[str, str | int]]  # Array of {value: simulationId, label: simulationName, count: int}
    scenarioOptions: list[dict[str, str | int]]  # Array of {value: scenarioId, label: scenarioTitle, count: int}


@router.post("/history", response_model=HomeHistoryResponse)
async def get_home_history(
    filters: HomeHistoryFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HomeHistoryResponse:
    """Get paginated home history with search, filters, sorting, and pagination."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Profile ID is passed as-is (including "guest-profile-id" string) - SQL handles resolution
        profile_id = filters.profileId

        # For roles above TA (instructional, admin, superadmin), ignore profileId to see all data
        # Only TAs should have profileId filtering applied
        if profile_id and profile_id != "guest-profile-id":
            try:
                # Check the role of the profile
                role_query = "SELECT role FROM profiles WHERE id = $1"
                role_row = await conn.fetchrow(role_query, profile_id)
                if role_row and role_row["role"] != "ta":
                    # Role is above TA, set profileId to None to ignore filtering
                    profile_id = None
            except Exception:
                # If we can't determine role, keep profileId as-is (fallback to safe behavior)
                pass

        # Load SQL query
        sql_query = load_sql("sql/v3/home/history.sql")

        # Build parameter list matching SQL file expectations:
        # $1, $2: dates (for WHERE clause)
        # $3: profile_id
        # $4: cohort_ids
        # $5: department_ids
        # $6: roles (scoped roles from filters, default to ["ta"] for backward compatibility)
        # $7: search term (optional)
        # $8: profileIds filter (optional)
        # $9: simulationIds filter (optional)
        # $10: scenarioIds filter (optional)
        # $11: infiniteMode filter (optional)
        # $12: sortBy column
        # $13: sortOrder (asc/desc)
        # $7: simulationFilters (text[], optional)
        # $8: search (text, optional)
        # $9: profileIds (uuid[], optional)
        # $10: simulationIds (uuid[], optional)
        # $11: scenarioIds (uuid[], optional)
        # $12: infiniteMode (bool, optional)
        # $13: sortBy (text)
        # $14: sortOrder (text)
        # $15: pageSize (int, LIMIT)
        # $16: offset (int, OFFSET)
        from datetime import datetime

        roles = filters.roles if filters.roles else ["ta"]
        simulation_filters = filters.simulationFilters if filters.simulationFilters else ["general"]
        params = [
            datetime.fromisoformat(filters.startDate.replace("Z", "+00:00")),  # $1
            datetime.fromisoformat(filters.endDate.replace("Z", "+00:00")),  # $2
            profile_id if profile_id else None,  # $3
            filters.cohortIds if filters.cohortIds else [],  # $4
            filters.departmentIds if filters.departmentIds else [],  # $5
            roles,  # $6
            simulation_filters,  # $7
            filters.search if filters.search else None,  # $8
            filters.profileIds if filters.profileIds else [],  # $9
            filters.simulationIds if filters.simulationIds else [],  # $10
            filters.scenarioIds if filters.scenarioIds else [],  # $11
            filters.infiniteMode,  # $12 (can be None)
            filters.sortBy,  # $13
            filters.sortOrder,  # $14
            filters.pageSize,  # $15
            filters.page * filters.pageSize,  # $16 (OFFSET)
        ]
        sql_params = tuple(params)

        # Debug logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"History query params: profile_id={profile_id}, cohortIds={filters.cohortIds}, departmentIds={filters.departmentIds}, roles={roles}, simulationFilters={simulation_filters}")
        logger.info(f"Date range: {filters.startDate} to {filters.endDate}")
        
        # Check if there are any attempts in the date range at all
        total_attempts = await conn.fetchval(
            "SELECT COUNT(*) FROM simulation_attempts WHERE created_at >= $1 AND created_at <= $2",
            params[0], params[1]
        )
        logger.info(f"Total attempts in date range: {total_attempts}")

        result = await conn.fetchrow(sql_query, *params)

        if not result:
            logger.warning("History query returned no result")
            return HomeHistoryResponse(
                data=[],
                totalCount=0,
                page=filters.page,
                pageSize=filters.pageSize,
                totalPages=0,
                profileOptions=[],
                simulationOptions=[],
                scenarioOptions=[],
            )
        
        logger.info(f"History query returned result with totalCount: {json.loads(result['result']) if isinstance(result['result'], str) else result['result'].get('totalCount', 0)}")

        # Parse JSON result
        parsed_result = json.loads(result["result"]) if isinstance(result["result"], str) else result["result"]

        # Parse history data
        history = []
        if isinstance(parsed_result.get("data"), list):
            for row in parsed_result["data"]:
                if isinstance(row, dict):
                    # Filter out None values from scenario_ids and scenario_titles arrays
                    if "scenario_ids" in row and isinstance(row["scenario_ids"], list):
                        row["scenario_ids"] = [s for s in row["scenario_ids"] if s is not None]
                    if "scenario_titles" in row and isinstance(row["scenario_titles"], list):
                        row["scenario_titles"] = [s for s in row["scenario_titles"] if s is not None]
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
        total_pages = (total_count + filters.pageSize - 1) // filters.pageSize if total_count > 0 else 0

        return HomeHistoryResponse(
            data=history,
            totalCount=total_count,
            page=filters.page,
            pageSize=filters.pageSize,
            totalPages=total_pages,
            profileOptions=profile_options,
            simulationOptions=simulation_options,
            scenarioOptions=scenario_options,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_home_history",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

