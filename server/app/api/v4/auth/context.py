"""Profile context endpoint with internal + HTTP-facing layers."""

from __future__ import annotations

import asyncio
import time
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.permissions import (
    build_artifact_has_generation_map,
    convert_cohort,
    convert_department,
    convert_draft,
    convert_role,
    convert_simulation,
    derive_theme_tokens,
)
from app.api.v4.auth.types import (
    GetProfileContextApiResponse,
    ProfileContextInternalData,
)
from app.api.v4.resources.cohorts.types import get_cohorts_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.roles.types import get_roles_internal
from app.api.v4.resources.settings.types import get_settings_internal
from app.api.v4.resources.simulations.types import get_simulations_batch_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.drafts.get import get_drafts_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetProfileContextAccessSqlParams,
    GetProfileContextAccessSqlRow,
    GetProfileContextApiRequest,
    GetSettingsThemeSqlParams,
    GetSettingsThemeSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

SQL_ACCESS_PATH = "app/sql/v4/queries/profile/get_profile_context_access_complete.sql"
SQL_SETTINGS_THEME_PATH = (
    "app/sql/v4/queries/settings/get_settings_theme_data_complete.sql"
)

router = APIRouter()


async def get_profile_context_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None,
    department_id_cookie: str | None,
    bypass_cache: bool = False,
) -> ProfileContextInternalData:
    """Resolve profile context graph for internal consumers.

    This returns hydrated facts only (no UI show/required flags).
    """
    pass1_start = time.time()

    params = GetProfileContextAccessSqlParams(
        profile_id=profile_id,
        department_id=department_id_cookie if department_id_cookie else None,
    )
    access_result = cast(
        GetProfileContextAccessSqlRow | None,
        await execute_sql_typed(conn, SQL_ACCESS_PATH, params=params),
    )

    pass1_time = (time.time() - pass1_start) * 1000

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

    pass2_start = time.time()

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database pool not available")

    department_ids = access_result.department_ids or []
    cohort_ids = access_result.cohort_ids or []
    simulation_ids = access_result.simulation_ids or []
    settings_id = access_result.settings_id
    draft_ids = access_result.draft_ids or []

    async def fetch_departments():
        if not department_ids:
            return []
        async with pool.acquire() as c:
            return await get_departments_internal(c, department_ids, bypass_cache)

    async def fetch_cohorts():
        if not cohort_ids:
            return []
        async with pool.acquire() as c:
            return await get_cohorts_internal(c, cohort_ids, bypass_cache)

    async def fetch_simulations():
        if not simulation_ids:
            return []
        async with pool.acquire() as c:
            return await get_simulations_batch_internal(c, simulation_ids, bypass_cache)

    async def fetch_settings_theme():
        if not settings_id:
            return None
        async with pool.acquire() as c:
            theme_params = GetSettingsThemeSqlParams(settings_id_param=settings_id)
            return cast(
                GetSettingsThemeSqlRow | None,
                await execute_sql_typed(
                    c, SQL_SETTINGS_THEME_PATH, params=theme_params
                ),
            )

    async def fetch_drafts():
        if not draft_ids:
            return []
        async with pool.acquire() as c:
            return await get_drafts_internal(c, draft_ids, bypass_cache)

    async def fetch_roles():
        async with pool.acquire() as c:
            return await get_roles_internal(c, bypass_cache)

    async def fetch_earliest_attempt_date():
        if not department_ids:
            return None
        async with pool.acquire() as c:
            return await c.fetchval(
                """
                SELECT MIN(attempt_created_at)
                FROM mv_attempt_facts
                WHERE department_id = ANY($1::uuid[])
                """,
                department_ids,
            )

    async def fetch_settings():
        if not settings_id:
            return None
        async with pool.acquire() as c:
            return await get_settings_internal(c, settings_id, bypass_cache)

    (
        departments_raw,
        cohorts_raw,
        simulations_raw,
        settings_theme,
        drafts_raw,
        roles_raw,
        earliest_attempt_date,
        settings_item,
    ) = await asyncio.gather(
        fetch_departments(),
        fetch_cohorts(),
        fetch_simulations(),
        fetch_settings_theme(),
        fetch_drafts(),
        fetch_roles(),
        fetch_earliest_attempt_date(),
        fetch_settings(),
    )

    if not settings_theme or not settings_theme.primary_color:
        raise HTTPException(
            status_code=500,
            detail="Settings theme not found in profile context",
        )

    # TODO: future provider->agent expansion in context graph
    settings_agents: list = []
    settings_tools: list = []

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

    pass2_time = (time.time() - pass2_start) * 1000

    return ProfileContextInternalData(
        access=access_result,
        actor_name=access_result.actor_name,
        user_role=access_result.role,
        primary_department_id=access_result.primary_department_id,
        departments=departments_raw,
        cohorts=cohorts_raw,
        simulations=simulations_raw,
        drafts=[convert_draft(d) for d in drafts_raw],
        settings=settings_item,
        settings_agents=settings_agents,
        settings_tools=settings_tools,
        role_resources=[convert_role(r) for r in roles_raw],
        settings_theme=settings_theme,
        settings_tokens=derive_theme_tokens(theme_primitives),
        earliest_attempt_date=earliest_attempt_date,
        artifact_has_generation=build_artifact_has_generation_map(
            access_result.artifact_agent_ids
        ),
        pass1_time_ms=pass1_time,
        pass2_time_ms=pass2_time,
    )


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
    """HTTP-facing profile context endpoint."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        try:
            profile_id = cast(UUID | None, http_request.state.profile_id)
        except AttributeError:
            profile_id = None

        department_id_cookie = http_request.cookies.get("department-id")
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        sql_query = load_sql_query(SQL_ACCESS_PATH)

        data = await get_profile_context_internal(
            conn=conn,
            profile_id=profile_id,
            department_id_cookie=department_id_cookie,
            bypass_cache=bypass_cache,
        )

        # Convert to legacy HTTP response shape for compatibility.
        departments = [convert_department(d) for d in data.departments]
        if data.primary_department_id:
            for dept in departments:
                if dept.department_id == data.primary_department_id:
                    dept.is_primary = True

        cohorts = [convert_cohort(c) for c in data.cohorts]
        simulations = [convert_simulation(s) for s in data.simulations]

        access = data.access
        department_ids = access.department_ids or []
        cohort_ids = access.cohort_ids or []
        simulation_ids = access.simulation_ids or []

        if data.actor_name and profile_id:
            audit_set(
                http_request,
                actor={"name": data.actor_name, "id": profile_id},
            )

        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{data.pass1_time_ms:.1f}"
        response.headers["X-Pass2-Time"] = f"{data.pass2_time_ms:.1f}"

        return GetProfileContextApiResponse(
            is_authorized=access.is_authorized,
            id=access.id,
            name=access.name,
            emails=None,
            primary_email=None,
            role=access.role,
            active=access.active,
            req_per_day=None,
            last_login=None,
            last_active=None,
            created_at=None,
            updated_at=None,
            primary_department_id=access.primary_department_id,
            departments=departments,
            cohorts=cohorts,
            simulations=simulations,
            earliest_attempt_date=data.earliest_attempt_date.isoformat()
            if data.earliest_attempt_date
            else None,
            scoped_roles=access.scoped_roles,
            role_resources=data.role_resources,
            settings_id=str(access.settings_id) if access.settings_id else None,
            settings_created_at=None,
            settings_active=None,
            settings_name=None,
            settings_description=None,
            settings_primary_color=data.settings_theme.primary_color,
            settings_accent=data.settings_theme.accent,
            settings_background=data.settings_theme.background,
            settings_surface=data.settings_theme.surface,
            settings_success=data.settings_theme.success,
            settings_warning=data.settings_theme.warning,
            settings_error=data.settings_theme.error,
            settings_sidebar_background=data.settings_theme.sidebar_background,
            settings_sidebar_primary=data.settings_theme.sidebar_primary,
            settings_chart1=data.settings_theme.chart1,
            settings_chart2=data.settings_theme.chart2,
            settings_chart3=data.settings_theme.chart3,
            settings_chart4=data.settings_theme.chart4,
            settings_chart5=data.settings_theme.chart5,
            settings_guest_login_enabled=None,
            settings_success_threshold=data.settings_theme.success_threshold,
            settings_warning_threshold=data.settings_theme.warning_threshold,
            settings_danger_threshold=data.settings_theme.danger_threshold,
            settings_auth_ids=None,
            settings_auths=None,
            settings_provider_ids=None,
            settings_providers=None,
            available_sections=access.available_sections,
            available_routes=access.available_routes,
            redirect_path=access.redirect_path,
            department_ids=[str(d) for d in department_ids] if department_ids else [],
            cohort_ids=[str(c) for c in cohort_ids] if cohort_ids else [],
            simulation_ids=[str(s) for s in simulation_ids] if simulation_ids else [],
            drafts=data.drafts,
            settings_tokens=data.settings_tokens,
            actor_name=data.actor_name,
            session_id=access.session_id,
            artifact_has_generation=data.artifact_has_generation,
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
