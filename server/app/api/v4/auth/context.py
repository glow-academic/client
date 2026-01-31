"""Profile context endpoint - get consolidated profile context.

2-Pass Architecture:
- Pass 1 (Light Query): Fast access check returning only IDs
- Pass 2 (Parallel Fetch): Concurrent fetching of full resources using asyncio.gather
"""

import asyncio
import time
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg

from app.api.v4.resources.cohorts.get import QGetCohortsV4Item, get_cohorts_internal
from app.api.v4.resources.departments.get import (
    QGetDepartmentsV4Item,
    get_departments_internal,
)
from app.api.v4.resources.roles.get import QGetRolesV4Item, get_roles_internal
from app.api.v4.resources.simulations.get import (
    GetSimulationsBatchV4Item,
    get_simulations_batch_internal,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.drafts.get import QGetDraftsV4Item, get_drafts_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetProfileContextAccessSqlParams,
    GetProfileContextAccessSqlRow,
    GetProfileContextApiRequest,
    GetSettingsThemeSqlParams,
    GetSettingsThemeSqlRow,
    QGetProfileContextV4Auth,
    QGetProfileContextV4Cohort,
    QGetProfileContextV4Department,
    QGetProfileContextV4Draft,
    QGetProfileContextV4Provider,
    QGetProfileContextV4RoleResource,
    QGetProfileContextV4Simulation,
    QGetProfileContextV4ThemeTokens,
    load_sql_query,
)
from app.sql.types import (
    GetProfileContextApiResponse as BaseGetProfileContextApiResponse,
)
from app.utils.sql_helper import execute_sql_typed


class GetProfileContextApiResponse(BaseGetProfileContextApiResponse):
    """Extended profile context response with artifact_agent_ids."""

    artifact_agent_ids: dict[str, UUID | None] | None = None


from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.utils.theme.color_utils import ensure_contrast, shade, tint
from app.utils.theme.oklch_to_hex import hex_to_oklch

# Load SQL with types at module level
SQL_ACCESS_PATH = "app/sql/v4/queries/profile/get_profile_context_access_complete.sql"
SQL_SETTINGS_THEME_PATH = (
    "app/sql/v4/queries/resources/settings/get_settings_theme_complete.sql"
)

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================


def normalize_color_to_oklch(color: str) -> str:
    """Normalize color input to oklch format."""
    color_trimmed = color.strip()
    if color_trimmed.startswith("oklch("):
        return color_trimmed
    hex_clean = color_trimmed.lstrip("#")
    if len(hex_clean) != 6 or not all(c in "0123456789ABCDEFabcdef" for c in hex_clean):
        raise ValueError(
            f"Invalid color format: {color}. Expected hex (e.g., '#ffffff') or oklch (e.g., 'oklch(1 0 0)')"
        )
    return hex_to_oklch(f"#{hex_clean}")


def derive_theme_tokens(primitives: dict[str, str]) -> QGetProfileContextV4ThemeTokens:
    """Derive full ThemeTokens from user-editable ThemePrimitives."""
    # Normalize all color inputs to oklch format
    background = normalize_color_to_oklch(primitives.get("background", ""))
    surface = normalize_color_to_oklch(primitives.get("surface", ""))
    primary = normalize_color_to_oklch(primitives.get("primary", ""))
    accent = normalize_color_to_oklch(primitives.get("accent", ""))
    sidebar_bg = normalize_color_to_oklch(primitives.get("sidebar_background", ""))
    sidebar_primary = normalize_color_to_oklch(primitives.get("sidebar_primary", ""))
    success = normalize_color_to_oklch(primitives.get("success", ""))
    warning = normalize_color_to_oklch(primitives.get("warning", ""))
    error = normalize_color_to_oklch(primitives.get("error", ""))

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

    return QGetProfileContextV4ThemeTokens(
        background=background,
        foreground=foreground,
        card=surface,
        card_foreground=surface_fg,
        popover=surface,
        popover_foreground=surface_fg,
        primary_color=primary,
        primary_foreground=primary_fg,
        secondary=accent,
        secondary_foreground=accent_fg,
        muted=muted_color,
        muted_foreground=muted_fg,
        accent=accent,
        accent_foreground=accent_fg,
        destructive=error,
        border=border_color,
        input=input_color,
        ring=ring_color,
        success=success,
        success_foreground=success_fg,
        warning=warning,
        warning_foreground=warning_fg,
        info=info_color,
        info_foreground=info_fg,
        chart1=normalize_color_to_oklch(primitives.get("chart1", "")),
        chart2=normalize_color_to_oklch(primitives.get("chart2", "")),
        chart3=normalize_color_to_oklch(primitives.get("chart3", "")),
        chart4=normalize_color_to_oklch(primitives.get("chart4", "")),
        chart5=normalize_color_to_oklch(primitives.get("chart5", "")),
        sidebar=sidebar_bg,
        sidebar_foreground=sidebar_fg,
        sidebar_primary=sidebar_primary,
        sidebar_primary_foreground=sidebar_primary_fg,
        sidebar_accent=sidebar_accent,
        sidebar_accent_foreground=sidebar_accent_fg,
        sidebar_border=sidebar_border,
        sidebar_ring=sidebar_ring,
    )


def convert_department(item: QGetDepartmentsV4Item) -> QGetProfileContextV4Department:
    """Convert departments resource item to profile context department."""
    return QGetProfileContextV4Department(
        department_id=item.department_id,
        title=item.name,
        description=item.description,
        active=True,  # Only active departments are returned
        is_primary=False,  # Will be set after conversion
    )


def convert_cohort(item: QGetCohortsV4Item) -> QGetProfileContextV4Cohort:
    """Convert cohorts resource item to profile context cohort."""
    return QGetProfileContextV4Cohort(
        cohort_id=item.cohort_id,
        title=item.title,
        description=item.description,
        active=item.active,
        department_ids=item.department_ids,
    )


def convert_simulation(
    item: GetSimulationsBatchV4Item,
) -> QGetProfileContextV4Simulation:
    """Convert simulations batch item to profile context simulation."""
    return QGetProfileContextV4Simulation(
        simulation_id=item.simulation_id,
        title=item.title,
        description=item.description,
        department_ids=item.department_ids,
        time_limit=item.time_limit,
        active=item.active,
        practice_simulation=item.practice_simulation,
    )


def convert_draft(item: QGetDraftsV4Item) -> QGetProfileContextV4Draft:
    """Convert draft item to profile context draft."""
    return QGetProfileContextV4Draft(
        id=item.id,
        artifact_type=item.artifact_type,
        payload=item.payload,
        version=item.version,
        updated_at=item.updated_at,
    )


def convert_role(item: QGetRolesV4Item) -> QGetProfileContextV4RoleResource:
    """Convert role item to profile context role."""
    return QGetProfileContextV4RoleResource(
        role=item.role,
        name=item.name,
        description=item.description,
        icon_value=item.icon_value,
        color_hex=item.color_hex,
    )


def convert_auth(auth: Any) -> QGetProfileContextV4Auth:
    """Convert settings auth item to profile context auth."""
    return QGetProfileContextV4Auth(
        auth_id=auth.auth_id,
        name=auth.name,
        description=auth.description,
        slug=auth.slug,
    )


def convert_provider(provider: Any) -> QGetProfileContextV4Provider:
    """Convert settings provider item to profile context provider."""
    return QGetProfileContextV4Provider(
        provider_id=provider.provider_id,
        name=provider.name,
        description=provider.description,
        value=provider.value,
    )


# =============================================================================
# Main Endpoint
# =============================================================================


@router.post(
    "/context",
    response_model=GetProfileContextApiResponse,
    dependencies=[
        audit_activity("profile.context", "{{ actor.name }} viewed profile context")
    ],
)
async def get_profile_context(
    request: GetProfileContextApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileContextApiResponse:
    """
    Get consolidated profile context (profile, departments, cohorts, breadcrumbs).

    Uses 2-pass architecture:
    - Pass 1: Light query returning IDs for access check
    - Pass 2: Parallel fetching of full resources

    NOTE: Theme derivation stays in Python because it requires complex color math utilities
    (hex_to_oklch, ensure_contrast, shade, tint) that are not available in PostgreSQL.
    """
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        from app.utils.logging.db_logger import get_logger

        logger = get_logger(__name__)

        # Read profile ID from request.state
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        # Get pathname from request URL
        pathname = http_request.url.path
        logger.info(f"Request: pathname={pathname}, profileId={profile_id}")

        # Read department-id cookie for settings resolution
        department_id_cookie = http_request.cookies.get("department-id")

        # Check for cache bypass header
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        # =================================================================
        # PASS 1: Light Query (Access Check + IDs)
        # =================================================================
        pass1_start = time.time()

        sql_query = load_sql_query(SQL_ACCESS_PATH)
        params = GetProfileContextAccessSqlParams(
            profile_id=cast(UUID | None, profile_id),
            department_id=department_id_cookie if department_id_cookie else None,
        )

        access_result = cast(
            GetProfileContextAccessSqlRow | None,
            await execute_sql_typed(conn, SQL_ACCESS_PATH, params=params),
        )

        pass1_time = (time.time() - pass1_start) * 1000  # ms

        # Handle authorization checks
        is_settings_only_request = not profile_id and department_id_cookie is not None

        if is_settings_only_request:
            if access_result is None or access_result.settings_id is None:
                raise HTTPException(
                    status_code=404,
                    detail="Settings not available for this department. Please select a different department.",
                )
        elif not profile_id and not department_id_cookie:
            raise HTTPException(
                status_code=404,
                detail="Profile context not found: Could not resolve profile. Please try logging in again.",
            )

        if (
            not is_settings_only_request
            and profile_id
            and (not access_result or not access_result.is_authorized)
        ):
            raise HTTPException(
                status_code=404,
                detail=f"Profile context not found: {profile_id}",
            )

        if not access_result:
            raise HTTPException(status_code=404, detail="Profile context not found")

        # =================================================================
        # PASS 2: Parallel Resource Fetching
        # =================================================================
        pass2_start = time.time()

        pool = get_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database pool not available")

        # Extract IDs from Pass 1 result
        department_ids = access_result.department_ids or []
        cohort_ids = access_result.cohort_ids or []
        simulation_ids = access_result.simulation_ids or []
        settings_id = access_result.settings_id
        draft_ids = access_result.draft_ids or []

        # Define parallel fetch functions
        async def fetch_departments() -> list[QGetDepartmentsV4Item]:
            if not department_ids:
                return []
            async with pool.acquire() as c:
                return await get_departments_internal(c, department_ids, bypass_cache)

        async def fetch_cohorts() -> list[QGetCohortsV4Item]:
            if not cohort_ids:
                return []
            async with pool.acquire() as c:
                return await get_cohorts_internal(c, cohort_ids, bypass_cache)

        async def fetch_simulations() -> list[GetSimulationsBatchV4Item]:
            if not simulation_ids:
                return []
            async with pool.acquire() as c:
                return await get_simulations_batch_internal(
                    c, simulation_ids, bypass_cache
                )

        async def fetch_settings_theme() -> GetSettingsThemeSqlRow | None:
            if not settings_id:
                return None
            async with pool.acquire() as c:
                params = GetSettingsThemeSqlParams(settings_id_param=settings_id)
                return cast(
                    GetSettingsThemeSqlRow | None,
                    await execute_sql_typed(c, SQL_SETTINGS_THEME_PATH, params=params),
                )

        async def fetch_drafts() -> list[QGetDraftsV4Item]:
            if not draft_ids:
                return []
            async with pool.acquire() as c:
                return await get_drafts_internal(c, draft_ids, bypass_cache)

        async def fetch_roles() -> list[QGetRolesV4Item]:
            async with pool.acquire() as c:
                return await get_roles_internal(c, bypass_cache)

        async def fetch_earliest_attempt_date():
            """Fetch earliest attempt date across all departments the profile belongs to."""
            if not profile_id:
                return None
            async with pool.acquire() as c:
                return await c.fetchval(
                    """
                    SELECT MIN(sa.created_at)
                    FROM profile_departments_junction pd_effective
                    JOIN profile_departments_junction pd_all
                        ON pd_all.department_id = pd_effective.department_id
                        AND pd_all.active = true
                    JOIN profile_profiles_junction ppj ON ppj.profile_id = pd_all.profile_id
                    JOIN simulation_attempts_profiles_connection sapc ON sapc.profiles_id = ppj.profiles_id
                    JOIN view_simulation_attempts_entry sa ON sa.id = sapc.attempt_id
                    WHERE pd_effective.profile_id = $1
                      AND pd_effective.active = true
                    """,
                    profile_id,
                )

        # Execute all fetches in parallel
        (
            departments_raw,
            cohorts_raw,
            simulations_raw,
            settings_theme,
            drafts_raw,
            roles_raw,
            earliest_attempt_date,
        ) = await asyncio.gather(
            fetch_departments(),
            fetch_cohorts(),
            fetch_simulations(),
            fetch_settings_theme(),
            fetch_drafts(),
            fetch_roles(),
            fetch_earliest_attempt_date(),
        )

        pass2_time = (time.time() - pass2_start) * 1000  # ms

        # =================================================================
        # Assemble Response
        # =================================================================

        # Convert to profile context types
        departments = [convert_department(d) for d in departments_raw]
        # Mark primary department
        if access_result.primary_department_id:
            for dept in departments:
                if dept.department_id == access_result.primary_department_id:
                    dept.is_primary = True

        cohorts = [convert_cohort(c) for c in cohorts_raw]
        simulations = [convert_simulation(s) for s in simulations_raw]
        drafts = [convert_draft(d) for d in drafts_raw]
        role_resources = [convert_role(r) for r in roles_raw]

        # Derive theme tokens from settings (using lightweight theme query)
        if not settings_theme or not settings_theme.primary_color:
            raise HTTPException(
                status_code=500, detail="Settings theme not found in profile context"
            )

        theme_primitives = {
            "primary": settings_theme.primary_color or "",
            "accent": settings_theme.accent or "",
            "background": settings_theme.background or "",
            "surface": settings_theme.surface or "",
            "success": settings_theme.success or "",
            "warning": settings_theme.warning or "",
            "error": settings_theme.error or "",
            "sidebar_background": settings_theme.sidebar_background or "",
            "sidebar_primary": settings_theme.sidebar_primary or "",
            "chart1": settings_theme.chart1 or "",
            "chart2": settings_theme.chart2 or "",
            "chart3": settings_theme.chart3 or "",
            "chart4": settings_theme.chart4 or "",
            "chart5": settings_theme.chart5 or "",
        }
        theme_tokens = derive_theme_tokens(theme_primitives)

        # Build artifact_agent_ids map
        artifact_agent_ids_map: dict[str, UUID | None] = {}
        if access_result.artifact_agent_ids:
            for item in access_result.artifact_agent_ids:
                if item.artifact:
                    artifact_agent_ids_map[item.artifact] = item.general_agent_id

        # Set audit context
        if access_result.actor_name and profile_id:
            audit_set(
                http_request,
                actor={"name": access_result.actor_name, "id": profile_id},
            )

        # Add observability headers
        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{pass1_time:.1f}"
        response.headers["X-Pass2-Time"] = f"{pass2_time:.1f}"

        # Build response
        api_response = GetProfileContextApiResponse(
            is_authorized=access_result.is_authorized,
            id=access_result.id,
            name=access_result.name,
            emails=None,  # Not fetched in 2-pass
            primary_email=None,  # Not fetched in 2-pass
            role=access_result.role,
            active=access_result.active,
            req_per_day=None,  # Not fetched in 2-pass
            last_login=None,  # Not fetched in 2-pass
            last_active=None,  # Not fetched in 2-pass
            created_at=None,  # Not fetched in 2-pass
            updated_at=None,  # Not fetched in 2-pass
            primary_department_id=access_result.primary_department_id,
            departments=departments,
            cohorts=cohorts,
            simulations=simulations,
            earliest_attempt_date=earliest_attempt_date.isoformat() if earliest_attempt_date else None,
            scoped_roles=access_result.scoped_roles,
            role_resources=role_resources,
            # Settings - ID from Pass 1, colors/thresholds from lightweight theme query
            settings_id=str(access_result.settings_id)
            if access_result.settings_id
            else None,
            settings_created_at=None,  # Not fetched in lightweight query
            settings_active=None,  # Not fetched in lightweight query
            settings_name=None,  # Not fetched in lightweight query
            settings_description=None,  # Not fetched in lightweight query
            settings_primary_color=settings_theme.primary_color,
            settings_accent=settings_theme.accent,
            settings_background=settings_theme.background,
            settings_surface=settings_theme.surface,
            settings_success=settings_theme.success,
            settings_warning=settings_theme.warning,
            settings_error=settings_theme.error,
            settings_sidebar_background=settings_theme.sidebar_background,
            settings_sidebar_primary=settings_theme.sidebar_primary,
            settings_chart1=settings_theme.chart1,
            settings_chart2=settings_theme.chart2,
            settings_chart3=settings_theme.chart3,
            settings_chart4=settings_theme.chart4,
            settings_chart5=settings_theme.chart5,
            settings_guest_login_enabled=None,  # Not fetched in lightweight query
            settings_success_threshold=settings_theme.success_threshold,
            settings_warning_threshold=settings_theme.warning_threshold,
            settings_danger_threshold=settings_theme.danger_threshold,
            settings_auth_ids=None,  # Not fetched in lightweight query
            settings_auths=None,  # Not fetched in lightweight query
            settings_provider_ids=None,  # Not fetched in lightweight query
            settings_providers=None,  # Not fetched in lightweight query
            available_sections=access_result.available_sections,
            available_routes=access_result.available_routes,
            redirect_path=access_result.redirect_path,
            department_ids=[str(d) for d in department_ids] if department_ids else [],
            cohort_ids=[str(c) for c in cohort_ids] if cohort_ids else [],
            simulation_ids=[str(s) for s in simulation_ids] if simulation_ids else [],
            drafts=drafts,
            settings_tokens=theme_tokens,
            actor_name=access_result.actor_name,
            session_id=access_result.session_id,
            artifact_agent_ids=artifact_agent_ids_map,
        )

        return api_response

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
