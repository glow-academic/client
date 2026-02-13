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
    convert_draft,
    convert_role,
    derive_theme_tokens,
)
from app.api.v4.auth.route_permissions import (
    compute_breadcrumbs,
    compute_page_access,
    compute_page_metadata,
    compute_sidebar_routes,
    get_entity_name_junction,
)
from app.api.v4.auth.types import (
    GetProfileContextApiResponse,
    ProfileContextInternalData,
)
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.cohorts.get import get_cohorts_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.roles.get import get_roles_internal
from app.api.v4.resources.settings.get import get_settings_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.drafts.get import get_drafts_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.infra.v4.sessions.get import get_session_internal
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
    settings_id = access_result.settings_id
    settings_agent_ids = access_result.settings_agent_ids or []
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

    async def fetch_settings():
        if not settings_id:
            return None
        async with pool.acquire() as c:
            return await get_settings_internal(c, settings_id, bypass_cache)

    async def fetch_settings_agents():
        if not settings_agent_ids:
            return []
        async with pool.acquire() as c:
            return await get_agents_internal(c, settings_agent_ids, bypass_cache)

    async def fetch_session():
        if not profile_id:
            return None
        async with pool.acquire() as c:
            return await get_session_internal(c, profile_id, bypass_cache)

    (
        departments_raw,
        cohorts_raw,
        settings_theme,
        drafts_raw,
        roles_raw,
        settings_item,
        settings_agents,
        session_id,
    ) = await asyncio.gather(
        fetch_departments(),
        fetch_cohorts(),
        fetch_settings_theme(),
        fetch_drafts(),
        fetch_roles(),
        fetch_settings(),
        fetch_settings_agents(),
        fetch_session(),
    )

    if not settings_theme or not settings_theme.primary_color:
        raise HTTPException(
            status_code=500,
            detail="Settings theme not found in profile context",
        )

    # Derive tools from settings agents
    all_tool_ids: list[UUID] = []
    for agent in settings_agents:
        if agent.tool_ids:
            all_tool_ids.extend(agent.tool_ids)
    settings_tools = []
    if all_tool_ids:
        async with pool.acquire() as c:
            settings_tools = await get_tools_internal(
                c, list(set(all_tool_ids)), bypass_cache
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

    pass2_time = (time.time() - pass2_start) * 1000

    return ProfileContextInternalData(
        access=access_result,
        actor_name=access_result.actor_name,
        user_role=access_result.role,
        primary_department_id=access_result.primary_department_id,
        departments=departments_raw,
        cohorts=cohorts_raw,
        drafts=[convert_draft(d) for d in drafts_raw],
        settings=settings_item,
        settings_agents=settings_agents,
        settings_tools=settings_tools,
        role_resources=[convert_role(r) for r in roles_raw],
        settings_theme=settings_theme,
        settings_tokens=derive_theme_tokens(theme_primitives),
        session_id=session_id,
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
        pathname = http_request.headers.get("X-Pathname", "")

        sql_query = load_sql_query(SQL_ACCESS_PATH)

        data = await get_profile_context_internal(
            conn=conn,
            profile_id=profile_id,
            department_id_cookie=department_id_cookie,
            bypass_cache=bypass_cache,
        )

        access = data.access

        if data.actor_name and profile_id:
            audit_set(
                http_request,
                actor={"name": data.actor_name, "id": profile_id},
            )

        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{data.pass1_time_ms:.1f}"
        response.headers["X-Pass2-Time"] = f"{data.pass2_time_ms:.1f}"

        # --- Server-driven routing computations ---
        available_sections = access.available_sections or []
        available_routes = access.available_routes or []

        sidebar_routes = compute_sidebar_routes(available_sections)
        breadcrumbs = compute_breadcrumbs(pathname) if pathname else []
        page_access = (
            compute_page_access(pathname, available_routes) if pathname else None
        )
        page_metadata = (
            compute_page_metadata(pathname, available_routes) if pathname else None
        )

        # Resolve entity name for breadcrumbs if pathname has a UUID
        if pathname and breadcrumbs:
            entity_info = get_entity_name_junction(pathname)
            if entity_info:
                entity_id, _entity_type, name_junction = entity_info
                try:
                    pool = get_pool()
                    if pool:
                        async with pool.acquire() as c:
                            entity_name = await c.fetchval(
                                f"SELECT nr.name FROM {name_junction} nj "  # noqa: S608
                                f"JOIN names_resource nr ON nr.id = nj.name_id "
                                f"WHERE nj.parent_id = $1::uuid "
                                f"AND nj.active = true LIMIT 1",
                                UUID(entity_id),
                            )
                        if entity_name:
                            # Replace the placeholder breadcrumb title
                            for bc in breadcrumbs:
                                if bc.url and entity_id in bc.url and "..." in bc.title:
                                    bc.title = entity_name
                except Exception:
                    pass  # Graceful fallback — keep truncated UUID

        return GetProfileContextApiResponse(
            is_authorized=access.is_authorized,
            id=access.id,
            name=access.name,
            role=access.role,
            active=access.active,
            scoped_roles=access.scoped_roles,
            available_sections=access.available_sections,
            available_routes=access.available_routes,
            redirect_path=access.redirect_path,
            settings_id=str(access.settings_id) if access.settings_id else None,
            settings_success_threshold=data.settings_theme.success_threshold,
            settings_warning_threshold=data.settings_theme.warning_threshold,
            settings_danger_threshold=data.settings_theme.danger_threshold,
            settings_tokens=data.settings_tokens,
            settings_agents=data.settings_agents,
            settings_tools=data.settings_tools,
            role_resources=data.role_resources,
            drafts=data.drafts,
            session_id=data.session_id,
            actor_name=data.actor_name,
            artifact_has_generation=data.artifact_has_generation,
            sidebar_routes=sidebar_routes,
            breadcrumbs=breadcrumbs if breadcrumbs else None,
            page_access=page_access,
            page_metadata=page_metadata,
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
