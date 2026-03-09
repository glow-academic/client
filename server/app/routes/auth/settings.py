"""POST /auth/settings — department-level settings + theme endpoint."""

from __future__ import annotations

import asyncio
import time
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.auth.settings import resolve_settings_theme
from app.infra.globals import get_pool, get_redis_client
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.auth.permissions import derive_theme_tokens
from app.routes.auth.types import (
    AuthSettingsInternalData,
    GetAuthSettingsApiResponse,
    SettingsAgentToolEntry,
)
from app.routes.shared_types import (
    GetProfileContextApiRequest,
    QGetProfileContextV4ThemeTokens,
)
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.settings.get import get_settings
from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.tools.get import get_tools
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


async def get_auth_settings_internal(
    profile_id: UUID | None,
    bypass_cache: bool = False,
) -> AuthSettingsInternalData:
    """Resolve settings graph — hydrated settings + agents + tools + theme.

    Underlying resource calls are individually cached, so repeated calls
    across artifact endpoints within the same request window are cheap.
    """
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile context not found")

    redis = get_redis_client()

    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database pool not available")

    async with pool.acquire() as conn:
        identity = await resolve_profile_identity_context(
            conn, profile_id, redis, bypass_cache=bypass_cache
        )
    if not identity:
        raise HTTPException(
            status_code=404, detail=f"Profile context not found: {profile_id}"
        )

    settings_id = identity.settings_id

    # Step 1: Fetch settings resource to get system_ids
    settings_item = None
    settings_system_ids: list[UUID] = []
    if settings_id:
        async with pool.acquire() as c:
            items = await get_settings(
                c, [settings_id], redis, bypass_cache=bypass_cache
            )
            if items:
                settings_item = items[0]
                settings_system_ids = list(settings_item.system_ids or [])

    # Step 2: Fetch systems and theme in parallel
    async def fetch_settings_theme():
        if not settings_id:
            return None
        async with pool.acquire() as c:
            return await resolve_settings_theme(
                c, redis, settings_id, bypass_cache=bypass_cache
            )

    async def fetch_systems():
        if not settings_system_ids:
            return []
        async with pool.acquire() as c:
            return await get_systems(
                c, settings_system_ids, redis, bypass_cache=bypass_cache
            )

    settings_theme, settings_systems = await asyncio.gather(
        fetch_settings_theme(),
        fetch_systems(),
    )

    # Step 3: Derive agent_ids from systems
    settings_agent_ids: list[UUID] = []
    for system in settings_systems:
        if system.agent_ids:
            settings_agent_ids.extend(system.agent_ids)
    settings_agent_ids = list(set(settings_agent_ids))

    # Step 4: Fetch agents
    settings_agents = []
    if settings_agent_ids:
        async with pool.acquire() as c:
            settings_agents = await get_agents(
                c, settings_agent_ids, redis, bypass_cache
            )

    if not settings_theme or not settings_theme.primary_color:
        return AuthSettingsInternalData(
            settings_id=settings_id,
            settings=None,
            settings_systems=[],
            settings_agents=[],
            settings_tools=[],
            settings_theme=settings_theme,
            settings_tokens=QGetProfileContextV4ThemeTokens(),
            artifact_has_generate={},
            agent_tool_entries=[],
        )

    # Step 5: Derive tools from settings agents
    all_tool_ids: list[UUID] = []
    for agent in settings_agents:
        if agent.tool_ids:
            all_tool_ids.extend(agent.tool_ids)
    settings_tools = []
    if all_tool_ids:
        async with pool.acquire() as c:
            settings_tools = await get_tools(
                c,
                list(set(all_tool_ids)),
                redis,
                bypass_cache=bypass_cache,
            )

    # Resolve agent→tool→resource entries in Python using already-fetched data.
    agent_tool_entries: list[SettingsAgentToolEntry] = []
    if settings_agents and settings_tools:
        tool_by_id = {t.id: t for t in settings_tools if t.id}
        for agent in settings_agents:
            if not agent.id or not agent.tool_ids:
                continue
            for tool_id in agent.tool_ids:
                tool = tool_by_id.get(tool_id)
                if tool and (tool.resources or tool.entries or tool.artifacts):
                    agent_tool_entries.append(
                        SettingsAgentToolEntry(
                            agent_id=agent.id,
                            tool_id=tool.id,
                            is_creatable=(tool.operation == "create"),
                            resource=(tool.resources[0] if tool.resources else None),
                            entry=(tool.entries[0] if tool.entries else None),
                            artifact=(tool.artifacts[0] if tool.artifacts else None),
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
        settings_systems=settings_systems,
        settings_agents=settings_agents,
        settings_tools=settings_tools,
        settings_theme=settings_theme,
        settings_tokens=derive_theme_tokens(theme_primitives),
        artifact_has_generate={},
        agent_tool_entries=agent_tool_entries,
    )


@router.post("/settings", response_model=GetAuthSettingsApiResponse)
async def get_auth_settings(
    request: GetProfileContextApiRequest,
    http_request: Request,
    response: Response,
) -> GetAuthSettingsApiResponse:
    """Department-level settings + theme endpoint."""
    try:
        try:
            profile_id = http_request.state.profile_id
        except AttributeError:
            profile_id = None

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        pass1_start = time.time()
        data = await get_auth_settings_internal(profile_id, bypass_cache)
        pass1_time = (time.time() - pass1_start) * 1000

        response.headers["X-Two-Pass"] = "1"
        response.headers["X-Pass1-Time"] = f"{pass1_time:.1f}"

        return GetAuthSettingsApiResponse(
            settings_id=str(data.settings_id) if data.settings_id else None,
            success_threshold=data.settings_theme.success_threshold
            if data.settings_theme
            else None,
            warning_threshold=data.settings_theme.warning_threshold
            if data.settings_theme
            else None,
            danger_threshold=data.settings_theme.danger_threshold
            if data.settings_theme
            else None,
            tokens=data.settings_tokens,
            systems=data.settings_systems,
            agents=data.settings_agents,
            tools=data.settings_tools,
            artifact_has_generate=data.artifact_has_generate,
        )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_settings",
            request=http_request,
        )
