"""Profile context endpoint - get consolidated profile context."""

import json
from typing import Annotated, Any, cast

import asyncpg
from app.api.v3.profile.detail import ProfileItem
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.permissions import (
    ProfileRole,
    get_available_subsections_for_role,
    get_redirect_path_for_role,
)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class ProfileContextRequest(BaseModel):
    """Request to get consolidated profile context."""

    actualProfileId: str  # The logged-in user's profile ID
    effectiveProfileId: str  # Could be same as actual, or emulated profile ID
    pathname: str  # Current path for breadcrumb generation


class CohortItem(BaseModel):
    """Cohort item."""

    id: str
    title: str
    description: str | None = None
    departmentIds: list[str] | None = None
    active: bool
    createdAt: str
    updatedAt: str


class DepartmentItem(BaseModel):
    """Department item."""

    id: str
    title: str
    description: str | None = None
    active: bool
    createdAt: str
    updatedAt: str


class CohortsData(BaseModel):
    """Cohorts data with member counts."""

    items: list[CohortItem]
    memberCounts: dict[str, int]


class SimulationContextItem(BaseModel):
    """Simplified simulation item for profile context."""

    id: str
    name: str
    description: str
    departmentIds: list[str] | None = None
    timeLimit: int | None
    active: bool
    practiceSimulation: bool


class SimulationsData(BaseModel):
    """Simulations data."""

    items: list[SimulationContextItem]


class ProfileContextResponse(BaseModel):
    """Response with consolidated profile context data."""

    actualProfile: ProfileItem
    effectiveProfile: ProfileItem
    departments: list[DepartmentItem]
    departmentIds: list[str]
    cohorts: CohortsData
    cohortIds: list[str]
    simulations: SimulationsData
    simulationIds: list[str]
    simulatableProfiles: list[ProfileItem]
    earliestAttemptDate: str | None  # ISO datetime of earliest simulation attempt
    availableSections: list[str]  # Sections available to the effective profile's role
    redirectPath: str  # Default redirect path for the effective profile's role


@router.post("/context", response_model=ProfileContextResponse)
async def get_profile_context(
    request: ProfileContextRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProfileContextResponse:
    """Get consolidated profile context (profile, departments, cohorts, breadcrumbs)."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        import logging

        logger = logging.getLogger(__name__)
        logger.info(f"Request: {request}")
        # Get all context data with guest-profile-id resolution and emulation validation in single query
        sql_query = load_sql("sql/v3/profile/get_profile_context_complete.sql")
        sql_params = (request.actualProfileId, request.effectiveProfileId)
        result = await conn.fetchrow(
            sql_query, request.actualProfileId, request.effectiveProfileId
        )

        if not result:
            # Check if it's an authorization failure (profiles differ) or not found
            if request.actualProfileId != request.effectiveProfileId:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have permission to view this profile's context",
                )
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile context not found: {request.effectiveProfileId}",
                )

        # Parse actual profile from result (with actual_ prefix)
        actual_profile = ProfileItem(
            id=str(result["actual_id"]),
            firstName=result["actual_first_name"],
            lastName=result["actual_last_name"],
            alias=result["actual_alias"],
            role=result["actual_role"],
            active=result["actual_active"],
            viewedIntro=result["actual_viewed_intro"],
            viewedChat=result["actual_viewed_chat"],
            defaultProfile=result["actual_default_profile"],
            reqPerDay=result["actual_req_per_day"],
            lastLogin=result["actual_last_login"].isoformat()
            if result["actual_last_login"]
            else "",
            lastActive=result["actual_last_active"].isoformat()
            if result["actual_last_active"]
            else "",
            createdAt=result["actual_created_at"].isoformat()
            if result["actual_created_at"]
            else "",
            updatedAt=result["actual_updated_at"].isoformat()
            if result["actual_updated_at"]
            else "",
            primaryDepartmentId=str(result["actual_primary_department_id"])
            if result.get("actual_primary_department_id")
            else None,
        )

        # Parse effective profile from result (unprefixed for backward compatibility)
        effective_profile = ProfileItem(
            id=str(result["id"]),
            firstName=result["first_name"],
            lastName=result["last_name"],
            alias=result["alias"],
            role=result["role"],
            active=result["active"],
            viewedIntro=result["viewed_intro"],
            viewedChat=result["viewed_chat"],
            defaultProfile=result["default_profile"],
            reqPerDay=result["req_per_day"],
            lastLogin=result["last_login"].isoformat() if result["last_login"] else "",
            lastActive=result["last_active"].isoformat()
            if result["last_active"]
            else "",
            createdAt=result["created_at"].isoformat() if result["created_at"] else "",
            updatedAt=result["updated_at"].isoformat() if result["updated_at"] else "",
            primaryDepartmentId=str(result["primary_department_id"])
            if result.get("primary_department_id")
            else None,
        )

        # Parse departments from JSONB (may be string or list)
        departments = []
        departments_data = result["departments"]
        if isinstance(departments_data, str):
            departments_data = json.loads(departments_data)
        if departments_data and isinstance(departments_data, list):
            for dept in departments_data:
                if isinstance(dept, dict):
                    departments.append(
                        DepartmentItem(
                            id=dept["id"],
                            title=dept["title"],
                            description=dept.get("description"),
                            active=dept["active"],
                            createdAt="",
                            updatedAt="",
                        )
                    )

        # Parse cohorts from JSONB (may be string or list)
        cohorts = []
        cohorts_data = result["cohorts"]
        if isinstance(cohorts_data, str):
            cohorts_data = json.loads(cohorts_data)
        if cohorts_data and isinstance(cohorts_data, list):
            for cohort in cohorts_data:
                if isinstance(cohort, dict):
                    cohorts.append(
                        CohortItem(
                            id=cohort["id"],
                            title=cohort["title"],
                            description=cohort.get("description"),
                            active=cohort["active"],
                            departmentIds=cohort.get("department_ids"),
                            createdAt="",
                            updatedAt="",
                        )
                    )

        # Parse simulations from JSONB (may be string or list)
        simulations = []
        simulations_data = result["simulations"]
        if isinstance(simulations_data, str):
            simulations_data = json.loads(simulations_data)
        if simulations_data and isinstance(simulations_data, list):
            for sim in simulations_data:
                if isinstance(sim, dict):
                    simulations.append(
                        SimulationContextItem(
                            id=sim["id"],
                            name=sim["title"],
                            description=sim.get("description", ""),
                            departmentIds=sim.get("department_ids"),
                            timeLimit=sim.get("time_limit"),
                            active=sim["active"],
                            practiceSimulation=sim["practice_simulation"],
                        )
                    )

        # Parse simulatable profiles from JSONB (may be string or list)
        simulatable_profiles = []
        simulatable_profiles_data = result["simulatable_profiles"]
        if isinstance(simulatable_profiles_data, str):
            simulatable_profiles_data = json.loads(simulatable_profiles_data)
        if simulatable_profiles_data and isinstance(simulatable_profiles_data, list):
            for sp in simulatable_profiles_data:
                if isinstance(sp, dict):
                    # Helper to convert datetime to ISO string if needed
                    def to_iso_string(val: Any) -> str:
                        if val is None:
                            return ""
                        if isinstance(val, str):
                            return val  # Already a string (from JSONB)
                        return val.isoformat()  # type: ignore

                    simulatable_profiles.append(
                        ProfileItem(
                            id=sp["id"],
                            firstName=sp["first_name"],
                            lastName=sp["last_name"],
                            alias=sp["alias"],
                            role=sp["role"],
                            active=sp["active"],
                            viewedIntro=sp["viewed_intro"],
                            viewedChat=sp["viewed_chat"],
                            defaultProfile=sp["default_profile"],
                            reqPerDay=sp["req_per_day"],
                            lastLogin=to_iso_string(sp.get("last_login")),
                            lastActive=to_iso_string(sp.get("last_active")),
                            createdAt=to_iso_string(sp.get("created_at")),
                            updatedAt=to_iso_string(sp.get("updated_at")),
                            primaryDepartmentId=sp["primary_department_id"]
                            if sp.get("primary_department_id")
                            else None,
                        )
                    )

        # Parse earliest attempt date
        earliest_attempt_date = None
        if result["earliest_attempt_date"]:
            earliest_attempt_date = result["earliest_attempt_date"].isoformat()

        # Extract IDs from collections
        dept_ids_list = [d.id for d in departments]
        cohort_ids_list = [c.id for c in cohorts]
        simulation_ids_list = [s.id for s in simulations]

        # Use permissions utilities for available sections and redirect path
        # (based on effective profile's role)
        role = cast(ProfileRole, effective_profile.role)
        available_sections = get_available_subsections_for_role(role)
        redirect_path = get_redirect_path_for_role(role)

        return ProfileContextResponse(
            actualProfile=actual_profile,
            effectiveProfile=effective_profile,
            departments=departments,
            departmentIds=dept_ids_list,
            cohorts=CohortsData(items=cohorts, memberCounts={}),
            cohortIds=cohort_ids_list,
            simulations=SimulationsData(items=simulations),
            simulationIds=simulation_ids_list,
            simulatableProfiles=simulatable_profiles,
            earliestAttemptDate=earliest_attempt_date,
            availableSections=available_sections,
            redirectPath=redirect_path,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_profile_context",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
