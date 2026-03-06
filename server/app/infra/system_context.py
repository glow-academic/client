"""Resolve system context — system → agents → models/providers/tools/args.

Given a system_id, fetches the system resource, then hydrates the full chain:
  system → agents → (models + tools) → (providers + args + args_outputs)

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.args.get import get_args
from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.providers.get import get_providers
from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.tools.get import get_tools


@dataclass(frozen=True)
class SystemContext:
    """Fully hydrated system with agents, models, providers, tools, args."""

    system_id: UUID
    agents: list  # GetAgentResponse
    models: list  # GetModelResponse
    providers: list  # GetProviderResponse
    tools: list  # GetToolResponse
    args: list  # GetArgResponse
    args_outputs: list  # GetArgOutputResponse


async def resolve_system_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    system_id: UUID,
    bypass_cache: bool = False,
) -> SystemContext | None:
    """Resolve a system into fully hydrated resources.

    Steps:
      1. Fetch system → agent_ids
      2. Fetch agents → collect model_ids + tool_ids
      3. Parallel: models + tools → collect provider_ids + args_ids + args_output_ids
      4. Parallel: providers + args + args_outputs
    """
    # Step 1: fetch system
    systems = await get_systems(conn, [system_id], redis, bypass_cache)
    if not systems:
        return None

    system = systems[0]
    agent_ids = system.agent_ids or []

    if not agent_ids:
        return SystemContext(
            system_id=system_id,
            agents=[],
            models=[],
            providers=[],
            tools=[],
            args=[],
            args_outputs=[],
        )

    # Step 2: fetch agents
    agents = await get_agents(conn, agent_ids, redis, bypass_cache)

    # Collect IDs for next level
    model_ids = list({a.model_id for a in agents if a.model_id})
    tool_ids = list({tid for a in agents for tid in (a.tool_ids or [])})

    # Step 3: parallel fetch models + tools
    models, tools = await asyncio.gather(
        get_models(conn, model_ids, redis, bypass_cache) if model_ids else _empty(),
        get_tools(conn, tool_ids, redis, bypass_cache) if tool_ids else _empty(),
    )

    # Collect IDs for final level
    provider_ids = list({m.provider_id for m in models if m.provider_id})
    args_ids = list({aid for t in tools for aid in (t.args_ids or [])})
    args_output_ids = list({aoid for t in tools for aoid in (t.args_output_ids or [])})

    # Step 4: parallel fetch providers + args + args_outputs
    providers, args_list, args_outputs_list = await asyncio.gather(
        get_providers(conn, provider_ids, redis, bypass_cache) if provider_ids else _empty(),
        get_args(conn, args_ids, redis, bypass_cache) if args_ids else _empty(),
        get_args_outputs(conn, args_output_ids, redis, bypass_cache) if args_output_ids else _empty(),
    )

    return SystemContext(
        system_id=system_id,
        agents=agents,
        models=models,
        providers=providers,
        tools=tools,
        args=args_list,
        args_outputs=args_outputs_list,
    )


async def _empty() -> list:
    return []
