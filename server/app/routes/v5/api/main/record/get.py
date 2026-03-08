"""Get endpoint for record artifact — internal + websocket layers.

Canonical composable pattern:
  resolve_common_context() → config chain hydration → Python assembly.

Zero inline SQL — all data from context resolver + resource fetchers.
"""

import asyncio
from dataclasses import dataclass, field
from uuid import UUID

import asyncpg

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_redis_client
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.record.types import (
    GetRecordApiRequest,
    GetRecordWebsocketResponse,
    RecordWebsocketEntries,
    RecordWebsocketResources,
)
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse
from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.tools.get import get_tools

# Record entry types for tool scoring
RECORD_ARTIFACT_RESOURCES: set[str] = {"problems"}


@dataclass
class RecordInternalData:
    """Internal data from core record fetching (cacheable layer)."""

    config_agents: list = field(default_factory=list)
    config_models: list = field(default_factory=list)
    config_providers: list = field(default_factory=list)
    config_tools: list = field(default_factory=list)
    config_systems: list = field(default_factory=list)
    config_profile: list = field(default_factory=list)
    runs_today: GetRunListViewResponse | None = None
    resource_agent_ids: dict[str, UUID | None] = field(default_factory=dict)
    resource_system_ids: dict[str, UUID | None] = field(default_factory=dict)
    group_id: UUID | None = None


async def get_record_internal(
    pool: asyncpg.Pool,
    profile_id: UUID,
    record_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> RecordInternalData:
    """Fetch config chain for record artifact.

    Uses resolve_common_context() for profile + tool_graph + runs,
    then hydrates agents/models/providers/tools from the tool_graph.
    """
    redis = get_redis_client()

    # Phase 0: Resolve common context (profile + tool_graph + runs)
    async with pool.acquire() as c:
        common = await resolve_common_context(
            c, redis, profile_id=profile_id, bypass_cache=bypass_cache
        )
    if not common:
        return RecordInternalData()

    # Phase 1: Score tools for record artifact
    scores = score_tools(common.tool_graph, RECORD_ARTIFACT_RESOURCES)

    # Extract unique IDs from the tool_graph
    all_system_ids = list(dict.fromkeys(t.system_id for t in common.tool_graph.tools))
    all_agent_ids = list(dict.fromkeys(t.agent_id for t in common.tool_graph.tools))
    all_tool_ids = list(dict.fromkeys(t.tool_id for t in common.tool_graph.tools))

    # Phase 2: Hydrate full resource objects in parallel
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

    async def _fetch_tools() -> list:
        if not all_tool_ids:
            return []
        async with pool.acquire() as c:
            return await get_tools(c, all_tool_ids, redis, bypass_cache)

    systems, agents, tools_list = await asyncio.gather(
        _fetch_systems(),
        _fetch_agents(),
        _fetch_tools(),
    )

    # Phase 3: Walk agent → model → provider chain
    model_ids = list(dict.fromkeys(
        a.model_id for a in agents if a.model_id
    ))

    async def _fetch_models() -> list:
        if not model_ids:
            return []
        async with pool.acquire() as c:
            return await get_models(c, model_ids, redis, bypass_cache)

    models = await _fetch_models()

    provider_ids = list(dict.fromkeys(
        m.provider_id for m in models if m.provider_id
    ))

    async def _fetch_providers() -> list:
        if not provider_ids:
            return []
        async with pool.acquire() as c:
            return await get_providers(c, provider_ids, redis, bypass_cache)

    providers = await _fetch_providers()

    # Phase 4: Build resource_agent_ids from tool scores
    resource_agent_ids: dict[str, UUID | None] = {
        target: (tool.agent_id if tool else None)
        for target, tool in scores.best.items()
    }
    resource_system_ids: dict[str, UUID | None] = {
        target: (tool.system_id if tool else None)
        for target, tool in scores.best.items()
    }

    # Phase 5: Profile resource for config profile
    config_profile = []
    if common.profile:
        from app.routes.v5.tools.resources.profiles.get import get_profiles

        async with pool.acquire() as c:
            config_profile = await get_profiles(
                c, [common.profile.profiles_id], redis, bypass_cache
            )

    return RecordInternalData(
        config_agents=agents,
        config_models=models,
        config_providers=providers,
        config_tools=tools_list,
        config_systems=systems,
        config_profile=config_profile,
        runs_today=common.runs.runs if common.runs else None,
        resource_agent_ids=resource_agent_ids,
        resource_system_ids=resource_system_ids,
        group_id=None,
    )


async def get_record_websocket(
    pool: asyncpg.Pool,
    profile_id: UUID,
    record_id: UUID | None = None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetRecordWebsocketResponse:
    """Thin wrapper for websocket consumers — config chain + rate limit info."""
    redis = get_redis_client()
    data = await get_record_internal(
        pool=pool,
        profile_id=profile_id,
        record_id=record_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Pre-fetch args and args_outputs from tool IDs
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

            async def fetch_args():  # noqa: ANN202
                if not all_args_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args(
                        c,
                        list(set(all_args_ids)),
                        redis,
                        bypass_cache=bypass_cache,
                    )

            async def fetch_args_outputs():  # noqa: ANN202
                if not all_args_output_ids:
                    return None
                async with pool.acquire() as c:
                    return await get_args_outputs(
                        c,
                        list(set(all_args_output_ids)),
                        redis,
                        bypass_cache=bypass_cache,
                    )

            config_args, config_args_outputs = await asyncio.gather(
                fetch_args(),
                fetch_args_outputs(),
            )

    return GetRecordWebsocketResponse(
        entries=RecordWebsocketEntries(
            runs=data.runs_today,
        ),
        resources=RecordWebsocketResources(),
        params=GetRecordApiRequest(record_id=record_id, draft_id=draft_id),
        systems=data.config_systems or None,
        agents=data.config_agents or None,
        models=data.config_models or None,
        providers=data.config_providers or None,
        tools=config_tools or None,
        args=config_args,
        args_outputs=config_args_outputs,
        profile=data.config_profile or None,
        resource_agent_ids=data.resource_agent_ids,
        resource_system_ids=data.resource_system_ids,
        group_id=data.group_id,
    )
