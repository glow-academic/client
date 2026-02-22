"""POST /auth/settings — department-level settings + theme endpoint."""

from __future__ import annotations

import asyncio
import time
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.access import get_access_internal
from app.api.v4.auth.permissions import (
    build_artifact_has_generation_map,
    derive_theme_tokens,
)
from app.api.v4.auth.types import (
    AuthSettingsInternalData,
    GetAuthSettingsApiResponse,
    SettingsAgentToolEntry,
)
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.settings.get import get_settings_internal
from app.api.v4.resources.tools.get import get_tools_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetProfileContextApiRequest,
    GetSettingsThemeDataSqlParams,
    GetSettingsThemeDataSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_SETTINGS_THEME_PATH = (
    "app/sql/v4/queries/settings/get_settings_theme_data_complete.sql"
)

router = APIRouter()


async def get_auth_settings_internal(
    conn: asyncpg.Connection,
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> AuthSettingsInternalData:
    """Resolve settings graph — hydrated settings + agents + tools + theme.

    Underlying resource calls are individually cached, so repeated calls
    across artifact endpoints within the same request window are cheap.
    """
    access = await get_access_internal(conn, profile_id, bypass_cache)

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database pool not available")

    settings_id = access.settings_id
    settings_agent_ids = access.settings_agent_ids or []

    async def fetch_settings_theme():
        if not settings_id:
            return None
        async with pool.acquire() as c:
            theme_params = GetSettingsThemeDataSqlParams(settings_id_param=settings_id)
            return cast(
                GetSettingsThemeDataSqlRow | None,
                await execute_sql_typed(
                    c, SQL_SETTINGS_THEME_PATH, params=theme_params
                ),
            )

    async def fetch_settings():
        if not settings_id:
            return None
        async with pool.acquire() as c:
            items = await get_settings_internal(c, [settings_id], bypass_cache)
            return items[0] if items else None

    async def fetch_agents():
        if not settings_agent_ids:
            return []
        async with pool.acquire() as c:
            return await get_agents_internal(c, settings_agent_ids, bypass_cache)

    (
        settings_theme,
        settings_item,
        settings_agents,
    ) = await asyncio.gather(
        fetch_settings_theme(),
        fetch_settings(),
        fetch_agents(),
    )

    if not settings_theme or not settings_theme.primary_color:
        raise HTTPException(
            status_code=500,
            detail="Settings theme not found in auth settings",
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

    # Resolve agent→tool→resource entries in Python using already-fetched data.
    # Each agent has tool_ids (tools_resource IDs), each tool has a resource type.
    agent_tool_entries: list[SettingsAgentToolEntry] = []
    if settings_agents and settings_tools:
        tool_by_id = {t.id: t for t in settings_tools if t.id}
        for agent in settings_agents:
            if not agent.id or not agent.tool_ids:
                continue
            for tool_id in agent.tool_ids:
                tool = tool_by_id.get(tool_id)
                if tool and tool.resource:
                    agent_tool_entries.append(
                        SettingsAgentToolEntry(
                            agent_id=agent.id,
                            tool_id=tool.id,
                            resource=tool.resource,
                            is_creatable=tool.createable or False,
                        )
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

    return AuthSettingsInternalData(
        settings_id=settings_id,
        settings=settings_item,
        settings_agents=settings_agents,
        settings_tools=settings_tools,
        settings_theme=settings_theme,
        settings_tokens=derive_theme_tokens(theme_primitives),
        artifact_has_generation=build_artifact_has_generation_map(
            access.artifact_agent_ids
        ),
        agent_tool_entries=agent_tool_entries,
    )


@router.post(
    "/settings",
    response_model=GetAuthSettingsApiResponse,
    dependencies=[
        audit_activity("auth.settings", "{{ actor.name }} viewed auth settings")
    ],
)
async def get_auth_settings(
    request: GetProfileContextApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthSettingsApiResponse:
    """Department-level settings + theme endpoint."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        pass1_start = time.time()
        data = await get_auth_settings_internal(conn, profile_id, bypass_cache)
        pass1_time = (time.time() - pass1_start) * 1000

        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{pass1_time:.1f}"

        return GetAuthSettingsApiResponse(
            settings_id=str(data.settings_id) if data.settings_id else None,
            success_threshold=data.settings_theme.success_threshold,
            warning_threshold=data.settings_theme.warning_threshold,
            danger_threshold=data.settings_theme.danger_threshold,
            tokens=data.settings_tokens,
            agents=data.settings_agents,
            tools=data.settings_tools,
            artifact_has_generation=data.artifact_has_generation,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
