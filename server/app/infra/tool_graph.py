"""Resolve the settings → systems → agents → tools graph.

Given a settings_resource ID, walks the chain using existing black-box
resource fetchers and returns a flat list of resolved tools with full
agent/system context. No raw SQL — purely composes existing functions.

Two public functions:
  resolve_tool_graph()  — async, fetches the chain, returns SettingsToolGraph
  score_tools()         — pure Python, scores/ranks tools for an artifact
"""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.routes.v5.tools.resources.agents.get import get_agents
from app.routes.v5.tools.resources.agents.types import GetAgentResponse
from app.routes.v5.tools.resources.settings.get import get_settings
from app.routes.v5.tools.resources.systems.get import get_systems
from app.routes.v5.tools.resources.tools.get import get_tools
from app.routes.v5.tools.resources.tools.types import GetToolResponse


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ResolvedTool:
    """A single tool fully resolved with its agent and system context."""

    system_id: UUID
    agent_id: UUID
    tool_id: UUID
    operation: str | None  # "create", "link", etc.
    target_type: str  # "resource", "entry", "artifact"
    target: str  # e.g. "names", "contents", "persona"


@dataclass
class SettingsToolGraph:
    """Flat list of resolved tools from a settings chain."""

    tools: list[ResolvedTool] = field(default_factory=list)


@dataclass(frozen=True)
class ScoredTool:
    """A resolved tool with a score for a specific artifact context."""

    tool: ResolvedTool
    coverage: int  # how many artifact resources this agent covers


@dataclass
class ArtifactToolScores:
    """Per-target best tool picks for a given artifact resource set."""

    best: dict[str, ResolvedTool | None]  # target -> best resolved tool
    has_any: dict[str, bool]  # target -> whether any tool exists


# ---------------------------------------------------------------------------
# resolve_tool_graph — async, composes black boxes
# ---------------------------------------------------------------------------


async def resolve_tool_graph(
    conn: asyncpg.Connection,
    settings_id: UUID,
    redis: Redis,
    bypass_cache: bool = False,
) -> SettingsToolGraph:
    """Walk settings → systems → agents → tools and return the flat graph.

    Each step depends on the previous, so the chain is sequential.
    """
    # Step 1: settings_resource → system_ids
    settings_list = await get_settings(conn, [settings_id], redis, bypass_cache)
    if not settings_list:
        return SettingsToolGraph()

    setting = settings_list[0]
    system_ids = setting.system_ids or []
    if not system_ids:
        return SettingsToolGraph()

    # Step 2: systems → agent_ids (per system)
    systems = await get_systems(conn, system_ids, redis, bypass_cache)
    if not systems:
        return SettingsToolGraph()

    # Build system_id → agent_ids mapping, collect all unique agent IDs
    system_agent_map: dict[UUID, list[UUID]] = {}
    all_agent_ids: list[UUID] = []
    for system in systems:
        agent_ids = system.agent_ids or []
        system_agent_map[system.id] = agent_ids
        all_agent_ids.extend(agent_ids)

    unique_agent_ids = list(dict.fromkeys(all_agent_ids))
    if not unique_agent_ids:
        return SettingsToolGraph()

    # Step 3: agents → tool_ids (per agent)
    agents = await get_agents(conn, unique_agent_ids, redis, bypass_cache)
    if not agents:
        return SettingsToolGraph()

    agent_by_id: dict[UUID, GetAgentResponse] = {a.id: a for a in agents}

    all_tool_ids: list[UUID] = []
    for agent in agents:
        all_tool_ids.extend(agent.tool_ids or [])

    unique_tool_ids = list(dict.fromkeys(all_tool_ids))
    if not unique_tool_ids:
        return SettingsToolGraph()

    # Step 4: tools → resources/entries/artifacts
    tools_list = await get_tools(conn, unique_tool_ids, redis, bypass_cache)
    tool_by_id: dict[UUID, GetToolResponse] = {t.id: t for t in tools_list}

    # Step 5: flatten into ResolvedTool list
    resolved: list[ResolvedTool] = []

    for system_id, agent_ids in system_agent_map.items():
        for agent_id in agent_ids:
            agent = agent_by_id.get(agent_id)
            if not agent:
                continue
            for tool_id in agent.tool_ids or []:
                tool = tool_by_id.get(tool_id)
                if not tool:
                    continue
                # Each tool can target multiple resources/entries/artifacts
                for resource in tool.resources or []:
                    resolved.append(
                        ResolvedTool(
                            system_id=system_id,
                            agent_id=agent_id,
                            tool_id=tool_id,
                            operation=tool.operation,
                            target_type="resource",
                            target=resource,
                        )
                    )
                for entry in tool.entries or []:
                    resolved.append(
                        ResolvedTool(
                            system_id=system_id,
                            agent_id=agent_id,
                            tool_id=tool_id,
                            operation=tool.operation,
                            target_type="entry",
                            target=entry,
                        )
                    )
                for artifact in tool.artifacts or []:
                    resolved.append(
                        ResolvedTool(
                            system_id=system_id,
                            agent_id=agent_id,
                            tool_id=tool_id,
                            operation=tool.operation,
                            target_type="artifact",
                            target=artifact,
                        )
                    )

    return SettingsToolGraph(tools=resolved)


# ---------------------------------------------------------------------------
# score_tools — pure Python, no I/O
# ---------------------------------------------------------------------------


def score_tools(
    graph: SettingsToolGraph,
    artifact_resources: set[str],
) -> ArtifactToolScores:
    """Score and pick the best tool per target for a given artifact.

    Scoring (per target):
      1. Only consider tools whose target is in artifact_resources
      2. Per agent, compute coverage = how many artifact_resources it covers
      3. Pick the agent with highest coverage (specialist wins)
      4. Deterministic tiebreak by agent_id

    Returns the best ResolvedTool per target, plus has_any flags.
    """
    if not graph.tools:
        return ArtifactToolScores(
            best=dict.fromkeys(artifact_resources),
            has_any={r: False for r in artifact_resources},
        )

    # Compute per-agent coverage: how many artifact_resources does each agent touch?
    agent_targets: dict[UUID, set[str]] = {}
    for t in graph.tools:
        agent_targets.setdefault(t.agent_id, set()).add(t.target)

    agent_coverage: dict[UUID, int] = {
        agent_id: len(targets & artifact_resources)
        for agent_id, targets in agent_targets.items()
    }

    # For each artifact resource, find the best tool
    best: dict[str, ResolvedTool | None] = {}
    has_any: dict[str, bool] = {}

    for resource in artifact_resources:
        candidates = [t for t in graph.tools if t.target == resource]
        has_any[resource] = len(candidates) > 0

        if not candidates:
            best[resource] = None
            continue

        # Pick by: highest coverage, then agent_id for determinism
        best[resource] = max(
            candidates,
            key=lambda t: (agent_coverage.get(t.agent_id, 0), t.agent_id),
        )

    return ArtifactToolScores(best=best, has_any=has_any)
