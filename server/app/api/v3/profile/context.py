"""Profile context endpoint - get consolidated profile context."""

import json
from typing import Annotated, Any, Literal, cast

import asyncpg
from app.api.v3.profile.detail import ProfileItem
from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.permissions import (ProfileRole,
                                   get_available_subsections_for_role)
from app.utils.sql_helper import load_sql
from app.utils.theme.color_utils import ensure_contrast, shade, tint
from app.utils.theme.oklch_to_hex import hex_to_oklch
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class ProfileContextRequest(BaseModel):
    """Request to get consolidated profile context.
    
    Note: actualProfileId and effectiveProfileId are now read from headers
    (X-Profile-Id and X-Effective-Profile-Id) instead of request body.
    These fields are kept for backward compatibility but are ignored.
    """
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


class ThemePrimitives(BaseModel):
    """
    High-level theme primitives that users can configure.
    These are stored in the database and edited in the admin UI.
    Following BCNF principles: no nulls (using defaults), minimal redundancy.
    """

    # Core brand
    primary: str  # Main brand/action color
    accent: str  # Secondary brand color (derived if not provided)

    # Layout
    background: str  # Page background
    surface: str  # Cards/panels (derived from background if not provided)

    # Status colors
    success: str
    warning: str
    error: str

    # Sidebar (derived from background/primary if not provided)
    sidebarBackground: str
    sidebarPrimary: str

    # Data/charts colors (normalized to 5 separate attributes)
    chart1: str
    chart2: str
    chart3: str
    chart4: str
    chart5: str


class ThemeTokens(BaseModel):
    """
    Full internal design tokens derived from ThemePrimitives.
    This is what components consume via CSS variables.
    Users do not edit this directly.
    """

    background: str
    foreground: str
    card: str
    cardForeground: str
    popover: str
    popoverForeground: str
    primary: str
    primaryForeground: str
    secondary: str
    secondaryForeground: str
    muted: str
    mutedForeground: str
    accent: str
    accentForeground: str
    destructive: str
    border: str
    input: str
    ring: str
    # Status tokens
    success: str
    successForeground: str
    warning: str
    warningForeground: str
    info: str
    infoForeground: str
    # Chart tokens
    chart1: str
    chart2: str
    chart3: str
    chart4: str
    chart5: str
    # Sidebar tokens
    sidebar: str
    sidebarForeground: str
    sidebarPrimary: str
    sidebarPrimaryForeground: str
    sidebarAccent: str
    sidebarAccentForeground: str
    sidebarBorder: str
    sidebarRing: str


class SettingsData(BaseModel):
    """Settings data included in profile context."""

    settings_id: str
    created_at: str
    active: bool
    name: str
    description: str
    mode: Literal["light", "dark", "system"] = "light"
    tokens: ThemeTokens
    guest_login_enabled: bool
    success_threshold: int
    warning_threshold: int
    danger_threshold: int
    guestProfileId: str | None = (
        None  # Guest profile ID from settings_default_guest table
    )
    defaultAccountProfileId: str | None = (
        None  # Default account profile ID from settings_default_account table
    )


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
    settings: SettingsData  # Active settings for the effective profile


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

        # Read profile IDs from request.state (set by router-level dependencies)
        # request.state.profile_id = actualProfileId (logged-in user's profile ID)
        # request.state.effective_profile_id = effectiveProfileId (could be same as actual, or emulated)
        actual_profile_id = getattr(http_request.state, "profile_id", None)
        effective_profile_id = getattr(http_request.state, "effective_profile_id", None)

        logger.info(f"Request: pathname={request.pathname}, actualProfileId={actual_profile_id}, effectiveProfileId={effective_profile_id}")

        # Read department-id and auth-mode cookies for profile resolution
        # These are used when actualProfileId/effectiveProfileId are null (cookie-based auth)
        # department-id can be null (for default settings)
        # auth-mode defaults to "default-account" if not provided
        # NOTE: This is the ONLY endpoint that reads these cookies (single source of truth)
        department_id_cookie = http_request.cookies.get("department-id")
        auth_mode_cookie = http_request.cookies.get("auth-mode")
        
        # #region agent log
        import asyncio
        import json

        log_data = {
            "location": "context.py:224",
            "message": "Backend received request",
            "data": {
                "actualProfileId": actual_profile_id,
                "effectiveProfileId": effective_profile_id,
                "department_id_cookie": department_id_cookie,
                "auth_mode_cookie": auth_mode_cookie,
            },
            "timestamp": int(__import__("time").time() * 1000),
            "sessionId": "debug-session",
            "runId": "run1",
            "hypothesisId": "E"
        }
        try:
            with open("/Users/ashoksaravanan/Coding/glow/.cursor/debug.log", "a") as f:
                f.write(json.dumps(log_data) + "\n")
        except:
            pass
        # #endregion

        # Default auth-mode to "default-account" ONLY when resolving from cookies (profile IDs are null)
        # For authenticated users (with profile IDs), auth-mode cookie should be None/absent
        # Logic: Only default to default-account when we're actually using cookie-based auth
        if not auth_mode_cookie and not actual_profile_id and not effective_profile_id:
            auth_mode_cookie = "default-account"

        # Validate auth_mode is valid (should always be valid after default)
        if auth_mode_cookie not in ("default-guest", "default-account"):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid auth-mode: {auth_mode_cookie}. Must be 'default-guest' or 'default-account'",
            )

        # Authorization checks for default-account and guest login
        # Only check when profile IDs are null (resolving from cookies)
        #
        # SECURITY: These checks prevent unauthorized access via default-account/guest login
        # when authentication providers are configured. This ensures users must use proper
        # authentication when it's available.
        #
        # Default-Account Login Authorization Rules:
        # 1. Zero active departments → Allow (initial setup before any departments exist)
        # 2. Department provided + department exists + no auth providers → Allow
        #    (New department without auth configured yet)
        # 3. No department + default settings have no auth + at least one dept without auth → Allow
        #    (Valid use case: new department being created)
        # 4. No department + default settings have auth providers → Block
        #    (Must use auth provider or select specific department)
        # 5. No department + all departments have auth providers → Block
        #    (Prevents bypass - must use auth provider)
        # 6. Department provided + department doesn't exist → Block (400 Bad Request)
        # 7. Department provided + department has auth providers → Block
        #    (Must use auth provider for that department)
        #
        # Guest Login Authorization Rules:
        # 1. guest_login_enabled = true → Allow
        # 2. guest_login_enabled = false → Block
        #
        # Edge Cases Handled:
        # - Invalid/non-existent department IDs: Validated before auth check
        # - Department exists but has no settings: Treated as "no auth providers" (intentional)
        # - Default settings don't exist: guest_login_enabled defaults to false (blocks guest)
        # - Inactive departments: Excluded from counts (department_exists checks active=true)
        # #region agent log
        should_check_auth = (
            not actual_profile_id
            and not effective_profile_id
            and auth_mode_cookie in ("default-account", "default-guest")
        )
        log_data = {
            "location": "context.py:270",
            "message": "Authorization check decision",
            "data": {
                "should_check_auth": should_check_auth,
                "actualProfileId": actual_profile_id,
                "effectiveProfileId": effective_profile_id,
                "auth_mode_cookie": auth_mode_cookie,
            },
            "timestamp": int(__import__("time").time() * 1000),
            "sessionId": "debug-session",
            "runId": "run1",
            "hypothesisId": "E"
        }
        try:
            with open("/Users/ashoksaravanan/Coding/glow/.cursor/debug.log", "a") as f:
                f.write(json.dumps(log_data) + "\n")
        except:
            pass
        # #endregion
        if should_check_auth:
            auth_check_sql = load_sql("sql/v3/profile/check_login_authorization.sql")
            auth_result = await conn.fetchrow(auth_check_sql, department_id_cookie)

            if not auth_result:
                raise HTTPException(
                    status_code=500,
                    detail="Unable to verify login authorization",
                )

            guest_login_enabled = auth_result.get("guest_login_enabled", False)
            active_dept_count = auth_result.get("active_departments_count", 0)
            dept_auth_count = auth_result.get("department_auth_providers_count", 0)
            default_auth_count = auth_result.get(
                "default_settings_auth_providers_count", 0
            )
            depts_without_auth_count = auth_result.get(
                "departments_without_auth_providers_count", 0
            )
            department_exists = auth_result.get("department_exists", False)

            # Check authorization based on auth_mode
            if auth_mode_cookie == "default-account":
                # Case 1: Zero active departments - allow (initial setup)
                if active_dept_count == 0:
                    # No departments exist yet, allow default-account login
                    pass
                # Case 2-7: Active departments exist - apply restrictions
                elif active_dept_count > 0:
                    if not department_id_cookie:
                        # No department specified - check if default settings allow it
                        # Case 4: Default settings have auth providers - block
                        if default_auth_count > 0:
                            raise HTTPException(
                                status_code=401,
                                detail="Default account login not available. Please select a department or use an authentication provider.",
                            )
                        # Case 5: All departments have auth providers - block (prevents bypass)
                        # Case 3: At least one department without auth - allow (valid use case)
                        if depts_without_auth_count == 0:
                            raise HTTPException(
                                status_code=401,
                                detail="Default account login not available. Please select a department or use an authentication provider.",
                            )
                    else:
                        # Department specified - validate it exists first
                        # Case 6: Department doesn't exist - block (400 Bad Request)
                        if not department_exists:
                            raise HTTPException(
                                status_code=400,
                                detail="Invalid department specified.",
                            )
                        # Case 7: Department has auth providers - block
                        # Case 2: Department exists and has no auth providers - allow
                        if dept_auth_count > 0:
                            raise HTTPException(
                                status_code=401,
                                detail="Default account login not available for this department. Please use an authentication provider.",
                            )

            elif auth_mode_cookie == "default-guest":
                # Guest login authorization: only allow if guest_login_enabled is true
                # Case 1: guest_login_enabled = true → Allow (no exception raised)
                # Case 2: guest_login_enabled = false → Block
                if not guest_login_enabled:
                    raise HTTPException(
                        status_code=401,
                        detail="Guest login is not enabled for this configuration.",
                    )

        # Get all context data with emulation validation in single query
        # Pass profile IDs (can be null) and cookie values (can be null) to SQL
        sql_query = load_sql("sql/v3/profile/get_profile_context_complete.sql")
        sql_params = (
            actual_profile_id,
            effective_profile_id,
            department_id_cookie,
            auth_mode_cookie,
        )

        # Check if profiles exist before running the main query
        # This prevents unnecessary SQL execution and provides clearer error messages
        if actual_profile_id:
            profile_check_sql = "SELECT id FROM profiles WHERE id = $1::uuid"
            actual_exists = await conn.fetchrow(
                profile_check_sql, actual_profile_id
            )
            if not actual_exists:
                raise HTTPException(
                    status_code=401,
                    detail=f"Session invalid: Profile {actual_profile_id} not found. Please sign in again.",
                )

        if (
            effective_profile_id
            and effective_profile_id != actual_profile_id
        ):
            profile_check_sql = "SELECT id FROM profiles WHERE id = $1::uuid"
            effective_exists = await conn.fetchrow(
                profile_check_sql, effective_profile_id
            )
            if not effective_exists:
                raise HTTPException(
                    status_code=401,
                    detail=f"Session invalid: Effective profile {effective_profile_id} not found. Please sign in again.",
                )

        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            # Check if it's an authorization failure (profiles differ) or not found
            resolved_actual = actual_profile_id
            resolved_effective = effective_profile_id

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

        # Parse settings from SQL result
        # Import theme derivation functions
        def normalize_color_to_oklch(color: str) -> str:
            """Normalize color input to oklch format."""
            color_trimmed = color.strip()
            if color_trimmed.startswith("oklch("):
                return color_trimmed
            hex_clean = color_trimmed.lstrip("#")
            if len(hex_clean) != 6 or not all(
                c in "0123456789ABCDEFabcdef" for c in hex_clean
            ):
                raise ValueError(
                    f"Invalid color format: {color}. Expected hex (e.g., '#ffffff') or oklch (e.g., 'oklch(1 0 0)')"
                )
            return hex_to_oklch(f"#{hex_clean}")

        def derive_theme_tokens(primitives: ThemePrimitives) -> ThemeTokens:
            """Derive full ThemeTokens from user-editable ThemePrimitives."""
            # Normalize all color inputs to oklch format
            background = normalize_color_to_oklch(primitives.background)
            surface = normalize_color_to_oklch(primitives.surface)
            primary = normalize_color_to_oklch(primitives.primary)
            accent = normalize_color_to_oklch(primitives.accent)
            sidebar_bg = normalize_color_to_oklch(primitives.sidebarBackground)
            sidebar_primary = normalize_color_to_oklch(primitives.sidebarPrimary)
            success = normalize_color_to_oklch(primitives.success)
            warning = normalize_color_to_oklch(primitives.warning)
            error = normalize_color_to_oklch(primitives.error)

            # Foregrounds based on contrast
            foreground = ensure_contrast(background, "oklch(0.145 0 0)")
            primary_fg = ensure_contrast(primary, "oklch(0.985 0 0)")
            accent_fg = ensure_contrast(accent, "oklch(0.205 0 0)")
            surface_fg = ensure_contrast(surface, foreground)

            # Status foregrounds
            success_fg = ensure_contrast(success, "oklch(0.985 0 0)")
            warning_fg = ensure_contrast(warning, "oklch(0.145 0 0)")
            error_fg = ensure_contrast(error, "oklch(0.985 0 0)")

            # Info derived from primary
            info_color = tint(primary, 0.05)
            info_fg = ensure_contrast(info_color, foreground)

            # Derived colors
            muted_color = shade(background, 0.03)
            muted_fg = shade(foreground, 0.2)
            border_color = shade(background, 0.078)
            input_color = shade(background, 0.078)
            ring_color = shade(primary, 0.05)

            # Sidebar derived colors
            sidebar_fg = ensure_contrast(sidebar_bg, surface_fg)
            sidebar_primary_fg = ensure_contrast(sidebar_primary, surface_fg)
            sidebar_accent = shade(sidebar_bg, 0.015)
            sidebar_accent_fg = ensure_contrast(sidebar_accent, surface_fg)
            sidebar_border = shade(sidebar_bg, 0.064)
            sidebar_ring = shade(sidebar_primary, 0.05)

            return ThemeTokens(
                background=background,
                foreground=foreground,
                card=surface,
                cardForeground=surface_fg,
                popover=surface,
                popoverForeground=surface_fg,
                primary=primary,
                primaryForeground=primary_fg,
                secondary=accent,
                secondaryForeground=accent_fg,
                muted=muted_color,
                mutedForeground=muted_fg,
                accent=accent,
                accentForeground=accent_fg,
                destructive=error,
                border=border_color,
                input=input_color,
                ring=ring_color,
                success=success,
                successForeground=success_fg,
                warning=warning,
                warningForeground=warning_fg,
                info=info_color,
                infoForeground=info_fg,
                chart1=normalize_color_to_oklch(primitives.chart1),
                chart2=normalize_color_to_oklch(primitives.chart2),
                chart3=normalize_color_to_oklch(primitives.chart3),
                chart4=normalize_color_to_oklch(primitives.chart4),
                chart5=normalize_color_to_oklch(primitives.chart5),
                sidebar=sidebar_bg,
                sidebarForeground=sidebar_fg,
                sidebarPrimary=sidebar_primary,
                sidebarPrimaryForeground=sidebar_primary_fg,
                sidebarAccent=sidebar_accent,
                sidebarAccentForeground=sidebar_accent_fg,
                sidebarBorder=sidebar_border,
                sidebarRing=sidebar_ring,
            )

        # Parse settings from SQL result
        if not result.get("settings_id"):
            raise HTTPException(
                status_code=500, detail="Settings not found in profile context"
            )

        theme_primitives = ThemePrimitives(
            primary=result["settings_primary_color"],
            accent=result["settings_accent"],
            background=result["settings_background"],
            surface=result["settings_surface"],
            success=result["settings_success"],
            warning=result["settings_warning"],
            error=result["settings_error"],
            sidebarBackground=result["settings_sidebar_background"],
            sidebarPrimary=result["settings_sidebar_primary"],
            chart1=result["settings_chart1"],
            chart2=result["settings_chart2"],
            chart3=result["settings_chart3"],
            chart4=result["settings_chart4"],
            chart5=result["settings_chart5"],
        )

        theme_tokens = derive_theme_tokens(theme_primitives)

        settings_data = SettingsData(
            settings_id=result["settings_id"],
            created_at=result["settings_created_at"].isoformat()
            if result["settings_created_at"]
            else "",
            active=result["settings_active"],
            name=result["settings_name"],
            description=result["settings_description"] or "",
            mode="light",
            tokens=theme_tokens,
            guest_login_enabled=result["settings_guest_login_enabled"],
            success_threshold=result["settings_success_threshold"],
            warning_threshold=result["settings_warning_threshold"],
            danger_threshold=result["settings_danger_threshold"],
            guestProfileId=result.get("settings_default_guest_profile_id"),
            defaultAccountProfileId=result.get("settings_default_account_profile_id"),
        )

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
            settings=settings_data,
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
