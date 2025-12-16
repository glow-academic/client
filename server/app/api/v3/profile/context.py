"""Profile context endpoint - get consolidated profile context."""

import json
from typing import Annotated, Any, cast

import asyncpg
from app.api.v3.profile.detail import ProfileItem
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.permissions import (ROUTE_PERMISSIONS, ProfileRole,
                                   get_available_subsections_for_role)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class ProfileContextRequest(BaseModel):
    """Request to get consolidated profile context."""

    actualProfileId: str | None = (
        None  # The logged-in user's profile ID (null if resolving from cookies)
    )
    effectiveProfileId: str | None = (
        None  # Could be same as actual, or emulated profile ID (null if resolving from cookies)
    )
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
    earliestAttemptDate: str | None  # ISO datetime of earliest simulation attempt
    availableSections: list[str]  # Sections available to the effective profile's role
    redirectPath: str  # Default redirect path for the effective profile's role
    scopedRoles: list[str]  # Roles that the effective profile has scope to see


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
        from app.utils.logging.db_logger import get_logger

        logger = get_logger(__name__)
        logger.info(f"Request: {request}")

        # Read department-id and auth-mode cookies for profile resolution
        # These are used when actualProfileId/effectiveProfileId are null
        # department-id can be null (for default settings), but auth-mode is required
        department_id_cookie = http_request.cookies.get("department-id")
        auth_mode_cookie = http_request.cookies.get("auth-mode")

        # Validate: if profile IDs are null, we must have auth-mode cookie
        # department-id can be null (will resolve to default settings)
        if (not request.actualProfileId or not request.effectiveProfileId) and (
            not auth_mode_cookie
        ):
            raise HTTPException(
                status_code=400,
                detail="Either actualProfileId/effectiveProfileId must be provided, or auth-mode cookie must be present (department-id is optional for default settings)",
            )

        # Validate auth_mode is valid
        if auth_mode_cookie and auth_mode_cookie not in (
            "default-guest",
            "default-account",
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid auth-mode: {auth_mode_cookie}. Must be 'default-guest' or 'default-account'",
            )

        # Get all context data with emulation validation in single query
        # Pass profile IDs (can be null) and cookie values (can be null) to SQL
        sql_query = load_sql("sql/v3/profile/get_profile_context_complete.sql")
        sql_params = (
            request.actualProfileId,
            request.effectiveProfileId,
            department_id_cookie,
            auth_mode_cookie,
        )

        # Check if profiles exist before running the main query
        # This prevents unnecessary SQL execution and provides clearer error messages
        if request.actualProfileId:
            profile_check_sql = "SELECT id FROM profiles WHERE id = $1::uuid"
            actual_exists = await conn.fetchrow(
                profile_check_sql, request.actualProfileId
            )
            if not actual_exists:
                raise HTTPException(
                    status_code=401,
                    detail=f"Session invalid: Profile {request.actualProfileId} not found. Please sign in again.",
                )

        if (
            request.effectiveProfileId
            and request.effectiveProfileId != request.actualProfileId
        ):
            profile_check_sql = "SELECT id FROM profiles WHERE id = $1::uuid"
            effective_exists = await conn.fetchrow(
                profile_check_sql, request.effectiveProfileId
            )
            if not effective_exists:
                raise HTTPException(
                    status_code=401,
                    detail=f"Session invalid: Effective profile {request.effectiveProfileId} not found. Please sign in again.",
                )

        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            # Check if it's an authorization failure (profiles differ) or not found
            resolved_actual = request.actualProfileId
            resolved_effective = request.effectiveProfileId

            # If we resolved from cookies, we need to check the result to see what was resolved
            # But if result is None, resolution failed
            if not resolved_actual or not resolved_effective:
                raise HTTPException(
                    status_code=404,
                    detail="Profile context not found: Could not resolve profile from department settings",
                )

            if resolved_actual != resolved_effective:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have permission to view this profile's context",
                )
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile context not found: {resolved_effective}",
                )

        # Parse actual profile from result (with actual_ prefix)
        actual_emails = result.get("actual_emails") or []
        actual_emails_list = actual_emails if isinstance(actual_emails, list) else []
        actual_profile = ProfileItem(
            id=str(result["actual_id"]),
            firstName=result["actual_first_name"],
            lastName=result["actual_last_name"],
            emails=actual_emails_list,
            primaryEmail=result.get("actual_primary_email"),
            role=result["actual_role"],
            active=result["actual_active"],
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
        effective_emails = result.get("emails") or []
        effective_emails_list = (
            effective_emails if isinstance(effective_emails, list) else []
        )
        effective_profile = ProfileItem(
            id=str(result["id"]),
            firstName=result["first_name"],
            lastName=result["last_name"],
            emails=effective_emails_list,
            primaryEmail=result.get("primary_email"),
            role=result["role"],
            active=result["active"],
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
        
        # Get redirect path for role (inlined from permissions.py)
        redirect_map = {
            "guest": "/practice",  # Guest users start at practice
            "member": "/home",  # Member users start at home
            "instructional": "/analytics/dashboard",  # Instructional staff starts at analytics dashboard
            "admin": "/analytics/dashboard",  # Admins start at analytics dashboard
            "superadmin": "/analytics/dashboard",  # Superadmins start at analytics dashboard
        }
        redirect_path = redirect_map.get(role, "/home")  # Default fallback to home

        # Parse scoped roles from SQL result (PostgreSQL array)
        scoped_roles_list: list[str] = []
        if result.get("scoped_roles"):
            scoped_roles_raw = result["scoped_roles"]
            # PostgreSQL arrays come as list from asyncpg
            if isinstance(scoped_roles_raw, list):
                scoped_roles_list = [str(role) for role in scoped_roles_raw]
            elif isinstance(scoped_roles_raw, str):
                # Handle string representation if needed
                scoped_roles_list = [
                    role.strip() for role in scoped_roles_raw.strip("{}").split(",")
                ]

        return ProfileContextResponse(
            actualProfile=actual_profile,
            effectiveProfile=effective_profile,
            departments=departments,
            departmentIds=dept_ids_list,
            cohorts=CohortsData(items=cohorts, memberCounts={}),
            cohortIds=cohort_ids_list,
            simulations=SimulationsData(items=simulations),
            simulationIds=simulation_ids_list,
            earliestAttemptDate=earliest_attempt_date,
            availableSections=available_sections,
            redirectPath=redirect_path,
            scopedRoles=scoped_roles_list,
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
