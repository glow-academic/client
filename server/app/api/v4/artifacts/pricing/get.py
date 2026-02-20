"""Get endpoint for pricing artifact — HTTP + websocket layers."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.group.list import get_group_list_internal
from app.api.v4.artifacts.group.types import GetGroupListRequest, GetGroupListResponse
from app.api.v4.artifacts.pricing.types import (
    GetPricingWebsocketResponse,
    PricingRequest,
    PricingResources,
    PricingResponse,
    PricingViews,
    PricingWebsocketResources,
    PricingWebsocketViews,
)
from app.api.v4.artifacts.types import FilterOption
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.entries.runs.search import (
    GetRunListViewResponse,
    get_run_list_entries_internal,
)
from app.api.v4.permissions import resolve_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

router = APIRouter()

# Pricing has no domain resources for agent resolution
PRICING_BUNDLE_RESOURCES: set[str] = set()


# =============================================================================
# Internal data + websocket layer
# =============================================================================


@dataclass
class PricingInternalData:
    """Internal data from core pricing fetching (cacheable layer)."""

    config_agents: list[QGetAgentsV4Item] = field(default_factory=list)
    config_models: list[QGetModelsV4Item] = field(default_factory=list)
    config_providers: list[QGetProvidersV4Item] = field(default_factory=list)
    config_tools: list[QGetToolsV4Item] = field(default_factory=list)
    config_profile: list[QGetProfilesV4Item] = field(default_factory=list)
    runs_today: GetRunListViewResponse | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None


async def get_pricing_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    pricing_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> PricingInternalData:
    """Fetch config chain for pricing artifact."""
    # 1. Settings-based agent resolution + config chain
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )
    agent_ids, _create_tool_ids, _link_tool_ids = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, PRICING_BUNDLE_RESOURCES
    )

    config_agents = list(settings_data.settings_agents)
    config_tools = list(settings_data.settings_tools)

    # 2. Extract model IDs from config agents → fetch models
    config_model_resource_ids = list(
        dict.fromkeys(a.model_id for a in settings_data.settings_agents if a.model_id)
    )
    config_models: list[Any] = []
    if config_model_resource_ids:
        async with pool.acquire() as conn:
            config_models = await get_models_internal(
                conn, config_model_resource_ids, bypass_cache
            )

    # 3. Extract provider IDs from models → fetch providers
    config_provider_resource_ids = list(
        dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
    )
    config_providers: list[Any] = []
    if config_provider_resource_ids:
        async with pool.acquire() as conn:
            config_providers = await get_providers_internal(
                conn, config_provider_resource_ids, bypass_cache
            )

    # 4. Fetch config profile + today's runs in parallel
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

    return PricingInternalData(
        config_agents=config_agents,
        config_models=config_models,
        config_providers=config_providers,
        config_tools=config_tools,
        config_profile=config_profile_result,
        runs_today=runs_result,
        resource_agent_ids=agent_ids,
        group_id=None,
    )


async def get_pricing_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    pricing_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetPricingWebsocketResponse:
    """Thin wrapper for websocket consumers — config chain + rate limit info."""
    data = await get_pricing_internal(
        pool=pool,
        profile_id=profile_id,
        pricing_id=pricing_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    return GetPricingWebsocketResponse(
        views=PricingWebsocketViews(
            runs=data.runs_today,
        ),
        resources=PricingWebsocketResources(
            config_agents=data.config_agents or None,
            config_models=data.config_models or None,
            config_providers=data.config_providers or None,
            config_tools=data.config_tools or None,
            config_profile=data.config_profile or None,
        ),
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def _fetch_group_history_data(
    pool: asyncpg.Pool,
    profile_id: UUID,
    request: PricingRequest,
    bypass_cache: bool,
) -> GetGroupListResponse:
    """Fetch group list history inline — adapted from group/list.py."""
    group_request = GetGroupListRequest(
        session_id=request.history_session_id,
        model_id=request.history_model_id,
        agent_id=request.history_agent_id,
        date_from=request.effective_date_from,
        date_to=request.effective_date_to,
        sort_by=request.history_sort_by,
        sort_order=request.history_sort_order,
        page_limit=request.history_page_size,
        page_offset=request.history_page * request.history_page_size,
    )
    async with pool.acquire() as conn:
        return await get_group_list_internal(
            conn=conn,
            profile_id=profile_id,
            request=group_request,
            bypass_cache=bypass_cache,
        )


@router.post(
    "/get",
    response_model=PricingResponse,
    dependencies=[
        audit_activity(
            "artifacts.pricing.get",
            "{{ actor.name }} fetched pricing artifact data",
        )
    ],
)
async def get_pricing(
    request: PricingRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingResponse:
    """Get pricing artifact data."""
    tags = ["artifacts", "pricing"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    pool = get_pool()

    try:
        profile_id = http_request.state.profile_id
        effective_date_from = request.effective_date_from
        effective_date_to = request.effective_date_to

        # Step 1: Fetch runs from runs_mv (+ optional group history in parallel)
        async def fetch_runs():
            async with pool.acquire() as c:
                return await get_run_list_entries_internal(
                    conn=c,
                    date_from=effective_date_from,
                    date_to=effective_date_to,
                    page_limit=request.page_limit,
                    page_offset=request.page_offset,
                    bypass_cache=bypass_cache,
                )

        parallel_tasks: list = [fetch_runs()]
        if request.history_enabled:
            parallel_tasks.append(
                _fetch_group_history_data(pool, profile_id, request, bypass_cache)
            )

        parallel_results = await asyncio.gather(*parallel_tasks)
        runs_result = parallel_results[0]
        history_data: GetGroupListResponse | None = (
            parallel_results[1] if request.history_enabled else None
        )

        # Step 2: Collect unique agent/model IDs from runs
        agent_ids_set: set[UUID] = set()
        model_ids_set: set[UUID] = set()

        for item in runs_result.items:
            if item.agent_ids:
                agent_ids_set.update(item.agent_ids)
            if item.model_ids:
                model_ids_set.update(item.model_ids)

        # Step 3: Batch hydrate agents + models in parallel
        async def fetch_agents():
            async with pool.acquire() as c:
                return await get_agents_internal(
                    c, list(agent_ids_set), bypass_cache=bypass_cache
                )

        async def fetch_models():
            async with pool.acquire() as c:
                return await get_models_internal(
                    c, list(model_ids_set), bypass_cache=bypass_cache
                )

        agents_list, models_list = await asyncio.gather(fetch_agents(), fetch_models())

        # Build resource maps
        agent_map = {str(a.id): {"name": a.name} for a in agents_list if a.id}
        model_map = {str(m.id): {"name": m.name} for m in models_list if m.id}

        # Build filter options
        model_options = [
            FilterOption(value=str(m.id), label=m.name) for m in models_list if m.id
        ]
        agent_options = [
            FilterOption(value=str(a.id), label=a.name) for a in agents_list if a.id
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return PricingResponse(
            views=PricingViews(runs=runs_result.items),
            resources=PricingResources(agents=agent_map, models=model_map),
            total_count=runs_result.total_count,
            model_options=model_options,
            agent_options=agent_options,
            history=history_data,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_pricing_get",
            request=http_request,
        )
