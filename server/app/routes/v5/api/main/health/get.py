"""Get endpoint for health artifact — internal + websocket layers."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.health.types import (
    GetHealthApiRequest,
    GetHealthWebsocketResponse,
    HealthRequest,
    HealthResponse,
    HealthViews,
    HealthWebsocketEntries,
    HealthWebsocketResources,
)
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.entries.health.get import get_health_list_view_internal
from app.routes.v5.api.entries.metrics.get import get_metric_list_view_internal
from app.routes.v5.api.entries.runs.search import (
    GetRunListViewResponse,
    get_run_list_entries_internal,
)
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.api.resources.args.get import get_args_internal
from app.routes.v5.api.resources.args_outputs.get import get_args_outputs_internal
from app.routes.v5.api.resources.models.get import get_models_internal
from app.routes.v5.api.resources.profiles.get import get_profiles_internal
from app.routes.v5.api.resources.providers.get import get_providers_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

router = APIRouter()

# Health entry types for agent resolution
HEALTH_BUNDLE_ENTRIES: set[str] = {"debug_info"}


@router.post("/get", response_model=HealthResponse)
async def get_health(
    request: HealthRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> HealthResponse:
    """Get health artifact data."""
    tags = ["artifacts", "health"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:

        async def fetch_service_hourly():
            async with pool.acquire() as c:
                return await get_health_list_view_internal(
                    conn=c,
                    service_filter=request.service,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        async def fetch_metrics_hourly():
            async with pool.acquire() as c:
                return await get_metric_list_view_internal(
                    conn=c,
                    date_from=request.date_from,
                    date_to=request.date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        service_hourly_result, metrics_hourly_result = await asyncio.gather(
            fetch_service_hourly(),
            fetch_metrics_hourly(),
        )

        views = HealthViews(
            service_hourly=service_hourly_result.items,
            metrics_hourly=metrics_hourly_result.items,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return HealthResponse(
            views=views,
            total_count=service_hourly_result.total_count,
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


@dataclass
class HealthInternalData:
    """Internal data from core health fetching (cacheable layer)."""

    config_agents: list[QGetAgentsV4Item] = field(default_factory=list)
    config_models: list[QGetModelsV4Item] = field(default_factory=list)
    config_providers: list[QGetProvidersV4Item] = field(default_factory=list)
    config_tools: list[QGetToolsV4Item] = field(default_factory=list)
    config_profile: list[QGetProfilesV4Item] = field(default_factory=list)
    runs_today: GetRunListViewResponse | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None


async def get_health_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    health_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> HealthInternalData:
    """Fetch config chain for health artifact.

    Returns a HealthInternalData dataclass consumed by the websocket wrapper.
    """
    # 1. Settings-based agent resolution + config chain
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, _create_tool_ids, _link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, HEALTH_BUNDLE_ENTRIES
    )

    config_agents = list(settings_data.settings_agents)
    config_tools = list(settings_data.settings_tools)

    config_model_resource_ids = list(
        dict.fromkeys(a.model_id for a in settings_data.settings_agents if a.model_id)
    )
    config_models: list[Any] = []
    if config_model_resource_ids:
        async with pool.acquire() as conn:
            config_models = await get_models_internal(
                conn, config_model_resource_ids, bypass_cache
            )

    config_provider_resource_ids = list(
        dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
    )
    config_providers: list[Any] = []
    if config_provider_resource_ids:
        async with pool.acquire() as conn:
            config_providers = await get_providers_internal(
                conn, config_provider_resource_ids, bypass_cache
            )

    # 2. Fetch config profile and today's runs in parallel
    async def fetch_config_profile() -> list[QGetProfilesV4Item]:
        async with pool.acquire() as c:
            return await get_profiles_internal(c, [profile_id], bypass_cache)

    async def fetch_runs_today() -> GetRunListViewResponse:
        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as c:
            return await get_run_list_entries_internal(
                conn=c,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    config_profile_result, runs_result = await asyncio.gather(
        fetch_config_profile(),
        fetch_runs_today(),
    )

    return HealthInternalData(
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        config_profile=config_profile_result,
        runs_today=runs_result,
        resource_agent_ids=agent_ids,
        group_id=None,
    )


async def get_health_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    health_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetHealthWebsocketResponse:
    """Thin wrapper for websocket consumers — config chain + rate limit info."""
    data = await get_health_internal(
        pool=pool,
        profile_id=profile_id,
        health_id=health_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_args = None
    config_args_outputs = None
    config_tools = data.config_tools
    if config_tools and pool:
        all_args_ids: list[UUID] = []
        all_args_output_ids: list[UUID] = []
        for tool in config_tools:
            if tool.args_ids:
                all_args_ids.extend(tool.args_ids)
            if tool.args_output_ids:
                all_args_output_ids.extend(tool.args_output_ids)

        if all_args_ids or all_args_output_ids:

            async def fetch_args():
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_internal(
                        c, list(set(all_args_ids)), bypass_cache=bypass_cache
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs_internal(
                        c, list(set(all_args_output_ids)), bypass_cache=bypass_cache
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    return GetHealthWebsocketResponse(
        entries=HealthWebsocketEntries(
            runs=data.runs_today,
        ),
        resources=HealthWebsocketResources(),
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=data.config_profile or None,
        params=GetHealthApiRequest(health_id=health_id, draft_id=draft_id),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )
