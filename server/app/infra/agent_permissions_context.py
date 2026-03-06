"""Resolve agent permissions context — lightweight access + edit check.

Given an agent_id, fetches just the data needed for permission checks:
  1. get_agents → department_ids

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.agent.get import (
    get_agents as get_agent_artifacts,
)


@dataclass(frozen=True)
class AgentPermissionsContext:
    """Lightweight context for agent permission checks."""

    exists: bool
    department_ids: list[UUID]


async def resolve_agent_permissions_context(
    conn: asyncpg.Connection,
    agent_id: UUID,
) -> AgentPermissionsContext:
    """Fetch just what's needed for agent permission checks.

    Single black-box tool call:
      1. get_agent_artifacts → department_ids
    """
    artifacts = await get_agent_artifacts(
        conn,
        [agent_id],
        departments=True,
    )

    if not artifacts:
        return AgentPermissionsContext(
            exists=False,
            department_ids=[],
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    return AgentPermissionsContext(
        exists=True,
        department_ids=department_ids,
    )
