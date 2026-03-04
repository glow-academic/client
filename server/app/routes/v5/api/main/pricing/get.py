"""Get endpoint for pricing artifact — HTTP + websocket layers."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main._shared.pricing import compute_costs_from_runs
from app.routes.v5.api.main.group.types import (
    GetGroupListRequest,
    GetGroupListResponse,
    GroupListItem,
)
from app.routes.v5.api.main.pricing.types import (
    GetPricingApiRequest,
    GetPricingWebsocketResponse,
    PricingDailyItem,
    PricingRequest,
    PricingResources,
    PricingResponse,
    PricingViews,
    PricingWebsocketEntries,
    PricingWebsocketResources,
)
from app.routes.v5.api.main.types import FilterOption
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.tools.entries.groups.get import get_group_list_view_internal
from app.routes.v5.tools.entries.runs.search import (
    GetRunListViewResponse,
    get_run_list_entries_internal,
)
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.profiles.get import get_profiles
from app.routes.v5.tools.resources.providers.get import get_providers
from app.sql.types import (
    QGetAgentsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# Pricing entry types for agent resolution
PRICING_BUNDLE_ENTRIES: set[str] = {"debug_info"}

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
        settings_data.agent_tool_entries, PRICING_BUNDLE_ENTRIES
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
            config_models = await get_models(
                conn, config_model_resource_ids, get_redis_client(), bypass_cache
            )

    # 3. Extract provider IDs from models → fetch providers
    config_provider_resource_ids = list(
        dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
    )
    config_providers: list[Any] = []
    if config_provider_resource_ids:
        async with pool.acquire() as conn:
            config_providers = await get_providers(                conn, config_provider_resource_ids, get_redis_client(), bypass_cache=bypass_cache            )

    # 4. Fetch config profile + today's runs in parallel
    async def fetch_config_profile() -> list[QGetProfilesV4Item]:
        async with pool.acquire() as c:
            return await get_profiles(c, [profile_id], get_redis_client(), bypass_cache)

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

    # Pre-fetch args and args_outputs from tool IDs (both cached via *_internal)
    config_tools = data.config_tools or []
    config_args = None
    config_args_outputs = None
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
                    return await get_args(
                        c,
                        list(set(all_args_ids)),
                        get_redis_client(),
                        bypass_cache=bypass_cache,
                    )

            async def fetch_args_outputs():
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c,
                        list(set(all_args_output_ids)),
                        get_redis_client(),
                        bypass_cache=bypass_cache,
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    return GetPricingWebsocketResponse(
        entries=PricingWebsocketEntries(
            runs=data.runs_today,
        ),
        resources=PricingWebsocketResources(),
        params=GetPricingApiRequest(pricing_id=pricing_id, draft_id=draft_id),
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=data.config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=data.config_profile or None,
        resource_agent_ids=data.resource_agent_ids,
        group_id=data.group_id,
    )


async def get_group_list_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    request: GetGroupListRequest,
    actor_name: str | None = None,
    bypass_cache: bool = False,
    cache_key_path: str = "/api/v5/artifacts/group/list",
) -> GetGroupListResponse:
    """Internal function for group list with resource hydration."""
    body = request.model_dump(mode="json")
    cache_key_val = cache_key(cache_key_path, body)

    if not bypass_cache:
        cached = await get_cached(cache_key_val, redis=get_redis_client())
        if cached:
            return GetGroupListResponse.model_validate(cached["data"])

    # Pass 1: Get paginated groups from groups_mv
    view_result = await get_group_list_view_internal(
        conn=conn,
        session_id_filter=request.session_id,
        date_from=request.date_from,
        date_to=request.date_to,
        sort_by=request.sort_by,
        sort_order=request.sort_order,
        page_limit=request.page_limit,
        page_offset=request.page_offset,
        bypass_cache=bypass_cache,
    )

    group_ids = [item.group_id for item in view_result.items]

    if not group_ids:
        return GetGroupListResponse(
            actor_name=actor_name,
            items=[],
            total_count=view_result.total_count,
        )

    # Pass 2: Get all runs for these groups via view internal
    runs_result = await get_run_list_entries_internal(
        conn=conn,
        group_ids=group_ids,
        page_limit=10000,
        bypass_cache=bypass_cache,
    )

    # Compute per-run costs
    run_costs = await compute_costs_from_runs(conn, runs_result.items, cache)

    # Aggregate run stats per group + collect all name IDs
    group_stats: dict[UUID, dict] = {}
    all_agent_ids: set[UUID] = set()
    all_model_ids: set[UUID] = set()
    all_profile_ids: set[UUID] = set()

    for run in runs_result.items:
        gid = run.group_id
        if not gid:
            continue
        if gid not in group_stats:
            group_stats[gid] = {
                "run_count": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "total_cost": Decimal("0"),
                "first_run_at": None,
                "last_run_at": None,
                "agent_ids": set(),
                "model_ids": set(),
            }
        stats = group_stats[gid]
        stats["run_count"] += 1
        stats["total_input_tokens"] += run.input_tokens
        stats["total_output_tokens"] += run.output_tokens
        stats["total_tokens"] += (
            run.input_tokens + run.output_tokens + run.cached_input_tokens
        )
        stats["total_cost"] += run_costs.get(run.run_id, Decimal("0"))
        if run.run_created_at:
            if (
                stats["first_run_at"] is None
                or run.run_created_at < stats["first_run_at"]
            ):
                stats["first_run_at"] = run.run_created_at
            if (
                stats["last_run_at"] is None
                or run.run_created_at > stats["last_run_at"]
            ):
                stats["last_run_at"] = run.run_created_at
        if run.agent_ids:
            stats["agent_ids"].update(run.agent_ids)
            all_agent_ids.update(run.agent_ids)
        if run.model_ids:
            stats["model_ids"].update(run.model_ids)
            all_model_ids.update(run.model_ids)

    # Fetch names via resource layer
    all_name_ids = list(all_agent_ids | all_model_ids | all_profile_ids)
    name_items = (
        await get_names(
            conn, all_name_ids, get_redis_client(), bypass_cache=bypass_cache
        )
        if all_name_ids
        else []
    )
    name_map = {item.id: item.name for item in name_items if item.id and item.name}

    # Assemble items
    items = []
    for view_item in view_result.items:
        gid = view_item.group_id
        stats = group_stats.get(gid, {})

        agent_id_list = list(stats.get("agent_ids", set()))
        model_id_list = list(stats.get("model_ids", set()))
        a_names = [name_map[aid] for aid in agent_id_list if aid in name_map] or None
        m_names = [name_map[mid] for mid in model_id_list if mid in name_map] or None

        items.append(
            GroupListItem(
                group_id=gid,
                session_id=view_item.session_id,
                profile_id=None,
                group_name=view_item.group_name,
                first_run_at=stats.get("first_run_at"),
                last_run_at=stats.get("last_run_at"),
                run_count=stats.get("run_count", 0),
                unique_agents=len(agent_id_list),
                unique_models=len(model_id_list),
                total_input_tokens=stats.get("total_input_tokens", 0),
                total_output_tokens=stats.get("total_output_tokens", 0),
                total_tokens=stats.get("total_tokens", 0),
                total_cost=stats.get("total_cost", Decimal("0")),
                agent_ids=agent_id_list or None,
                model_ids=model_id_list or None,
                profile_name=None,
                agent_names=a_names,
                model_names=m_names,
            )
        )

    api_response = GetGroupListResponse(
        actor_name=actor_name,
        items=items,
        total_count=view_result.total_count,
    )

    await set_cached(
        cache_key_val,
        {"data": api_response.model_dump(mode="json")},
        ttl=300,
        tags=["artifacts", "group", "list"],
        redis=get_redis_client(),
    )

    return api_response


async def _fetch_group_history_data(
    pool: asyncpg.Pool,
    profile_id: UUID,
    request: PricingRequest,
    bypass_cache: bool,
) -> GetGroupListResponse:
    """Fetch group list history inline."""
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
            cache=cache,
        )


@router.post("/get", response_model=PricingResponse)
async def get_pricing(
    request: PricingRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PricingResponse:
    """Get pricing artifact data."""
    tags = ["artifacts", "pricing"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
    cache = None if bypass_cache else (get_cached, set_cached)
    pool = get_pool()

    try:
        profile_id = http_request.state.profile_id
        effective_date_from = request.effective_date_from
        effective_date_to = request.effective_date_to

        # Step 1: Fetch ALL runs for aggregation (no pagination — runs are
        # only used for daily aggregation + ID extraction, not displayed raw)
        async def fetch_runs():
            async with pool.acquire() as c:
                return await get_run_list_entries_internal(
                    conn=c,
                    date_from=effective_date_from,
                    date_to=effective_date_to,
                    page_limit=100000,
                    page_offset=0,
                    bypass_cache=bypass_cache,
                )

        parallel_tasks: list = [
            fetch_runs(),
            _fetch_group_history_data(pool, profile_id, request, cache),
        ]

        parallel_results = await asyncio.gather(*parallel_tasks)
        runs_result = parallel_results[0]
        history_data: GetGroupListResponse | None = parallel_results[1]

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
                return await get_agents(
                    c, list(agent_ids_set), get_redis_client(), bypass_cache=bypass_cache
                )

        async def fetch_models():
            async with pool.acquire() as c:
                return await get_models(
                    c, list(model_ids_set), get_redis_client(), bypass_cache=bypass_cache
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

        # Step 4: Aggregate runs into daily buckets by (date, model_id)
        run_costs = await compute_costs_from_runs(conn, runs_result.items, cache)
        daily_buckets: dict[tuple[str, str | None], dict] = {}
        for run in runs_result.items:
            date_key = (
                run.run_created_at.strftime("%Y-%m-%d")
                if run.run_created_at
                else "unknown"
            )
            model_id = str(run.model_ids[0]) if run.model_ids else None
            bucket_key = (date_key, model_id)
            if bucket_key not in daily_buckets:
                daily_buckets[bucket_key] = {
                    "total_cost": Decimal("0"),
                    "run_count": 0,
                }
            daily_buckets[bucket_key]["total_cost"] += run_costs.get(
                run.run_id, Decimal("0")
            )
            daily_buckets[bucket_key]["run_count"] += 1

        daily_items = [
            PricingDailyItem(
                date_key=dk,
                model_id=mid,
                total_cost=bucket["total_cost"],
                run_count=bucket["run_count"],
            )
            for (dk, mid), bucket in sorted(
                daily_buckets.items(), key=lambda x: (x[0][0], x[0][1] or "")
            )
        ]

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return PricingResponse(
            views=PricingViews(runs=runs_result.items, daily=daily_items),
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
