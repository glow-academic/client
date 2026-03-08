"""Health artifact endpoint - POST /artifacts/health/get.

Two-layer BFF pattern:
- get_health_internal(): Core data fetcher via context resolver, returns HealthInternalData
- get_health (HTTP route): HTTP response layer

Uses composable context resolver with black-box MV search tools.
Zero inline SQL — all data from context resolver + resource fetchers.
"""

import asyncio
from datetime import datetime
from uuid import UUID

import asyncpg
from fastapi import APIRouter, HTTPException, Request, Response

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_pool, get_redis_client
from app.infra.health_context import resolve_health_context
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.health.types import (
    HealthInternalData,
    HealthRequest,
    HealthResponse,
    HealthViews,
)
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.tools.get import get_tools
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# Health entry types for tool scoring
HEALTH_BUNDLE_ENTRIES: set[str] = {"problems"}


# =============================================================================
# Layer 1: Core data fetcher (context resolver → pure Python assembly)
# =============================================================================


async def get_health_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    *,
    service: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page_limit: int = 168,
    page_offset: int = 0,
    health_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> HealthInternalData:
    """Core health data fetcher.

    Resolves health context (domain data) and common context (config chain)
    in parallel, then assembles HealthInternalData.
    """
    redis = get_redis_client()

    # Phase 0: Resolve both contexts in parallel
    async def _resolve_health() -> object:
        return await resolve_health_context(
            pool, redis,
            service=service,
            date_from=date_from,
            date_to=date_to,
            page_limit=page_limit,
            page_offset=page_offset,
            bypass_cache=bypass_cache,
        )

    async def _resolve_common() -> object:
        async with pool.acquire() as c:
            return await resolve_common_context(
                c, redis, profile_id=profile_id, bypass_cache=bypass_cache
            )

    ctx, common = await asyncio.gather(
        _resolve_health(),
        _resolve_common(),
    )

    # Extract domain entries from health context
    health = ctx.entries.get("health", [])
    metrics = ctx.entries.get("metrics", [])

    # Build config chain from common context (if available)
    config_agents: list = []
    config_models: list = []
    config_providers: list = []
    config_tools: list = []
    config_systems: list = []
    config_profile: list = []
    runs_today = None
    resource_agent_ids: dict[str, UUID | None] = {}
    resource_system_ids: dict[str, UUID | None] = {}

    if common:
        scores = score_tools(common.tool_graph, HEALTH_BUNDLE_ENTRIES)
        resource_agent_ids = {
            target: (tool.agent_id if tool else None)
            for target, tool in scores.best.items()
        }
        resource_system_ids = {
            target: (tool.system_id if tool else None)
            for target, tool in scores.best.items()
        }

        # Hydrate config chain from tool_graph
        all_system_ids = list(dict.fromkeys(
            t.system_id for t in common.tool_graph.tools
        ))
        all_agent_ids = list(dict.fromkeys(
            t.agent_id for t in common.tool_graph.tools
        ))
        all_tool_ids = list(dict.fromkeys(
            t.tool_id for t in common.tool_graph.tools
        ))

        async def _fetch_systems() -> list:
            if not all_system_ids:
                return []
            async with pool.acquire() as c:
                return await get_systems(c, all_system_ids, redis, bypass_cache)

        async def _fetch_agents() -> list:
            if not all_agent_ids:
                return []
            async with pool.acquire() as c:
                return await get_agents(c, all_agent_ids, redis, bypass_cache)

        async def _fetch_tools_config() -> list:
            if not all_tool_ids:
                return []
            async with pool.acquire() as c:
                return await get_tools(c, all_tool_ids, redis, bypass_cache)

        config_systems, config_agents, config_tools = await asyncio.gather(
            _fetch_systems(),
            _fetch_agents(),
            _fetch_tools_config(),
        )

        # Walk agent → model → provider chain
        model_ids = list(dict.fromkeys(
            a.model_id for a in config_agents if a.model_id
        ))
        if model_ids:
            async with pool.acquire() as c:
                config_models = await get_models(c, model_ids, redis, bypass_cache)

        provider_ids = list(dict.fromkeys(
            m.provider_id for m in config_models if m.provider_id
        ))
        if provider_ids:
            async with pool.acquire() as c:
                config_providers = await get_providers(
                    c, provider_ids, redis, bypass_cache
                )

        # Config profile
        if common.profile:
            from app.routes.v5.tools.resources.profiles.get import get_profiles

            async with pool.acquire() as c:
                config_profile = await get_profiles(
                    c, [common.profile.profiles_id], redis, bypass_cache
                )

        runs_today = common.runs if common.runs else None

    return HealthInternalData(
        health=health,
        metrics=metrics,
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        config_systems=config_systems,
        config_profile=config_profile,
        runs_today=runs_today,
        resource_agent_ids=resource_agent_ids,
        resource_system_ids=resource_system_ids,
        group_id=None,
    )


# =============================================================================
# Layer 2: HTTP Endpoint
# =============================================================================


@router.post("/get", response_model=HealthResponse)
async def get_health(
    request: HealthRequest,
    http_request: Request,
    response: Response,
) -> HealthResponse:
    """Get health artifact data."""
    tags = ["artifacts", "health"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        data = await get_health_internal(
            pool=pool,
            profile_id=profile_id,
            service=request.service,
            date_from=request.date_from,
            date_to=request.date_to,
            page_limit=request.page_limit,
            page_offset=request.page_offset,
            bypass_cache=bypass_cache,
        )

        views = HealthViews(
            service_hourly=data.health,
            metrics_hourly=data.metrics,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return HealthResponse(
            views=views,
            total_count=len(data.health),
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_health_get",
            request=http_request,
        )
