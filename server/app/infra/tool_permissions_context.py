"""Resolve tool permissions context — lightweight access + edit check.

Given a tool_id, fetches just the data needed for permission checks:
  1. get_tools → exists check (tools have no departments)
  2. search_agents(tool_ids=...) → any active agents using this tool?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.agent.search import search_agents
from app.routes.v5.tools.artifacts.tool.get import (
    get_tools as get_tool_artifacts,
)


@dataclass(frozen=True)
class ToolPermissionsContext:
    """Lightweight context for tool permission checks."""

    exists: bool
    active_agent_count: int


async def resolve_tool_permissions_context(
    conn: asyncpg.Connection,
    tool_id: UUID,
) -> ToolPermissionsContext:
    """Fetch just what's needed for tool permission checks.

    Two black-box tool calls:
      1. get_tool_artifacts → exists check
      2. search_agents(tool_ids=...) → any active agents using this tool?
    """
    artifacts = await get_tool_artifacts(conn, [tool_id])

    if not artifacts:
        return ToolPermissionsContext(
            exists=False,
            active_agent_count=0,
        )

    active_agent_ids = await search_agents(
        conn,
        tool_ids=[tool_id],
        active_only=True,
        limit_count=1,
    )

    return ToolPermissionsContext(
        exists=True,
        active_agent_count=len(active_agent_ids),
    )
