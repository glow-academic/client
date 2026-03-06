"""Resolve model permissions context — lightweight access + edit check.

Given a model_id, fetches just the data needed for permission checks:
  1. get_models → department_ids
  2. search_agents(model_ids=...) → any active agents using this model?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.agent.search import search_agents
from app.routes.v5.tools.artifacts.model.get import (
    get_models as get_model_artifacts,
)


@dataclass(frozen=True)
class ModelPermissionsContext:
    """Lightweight context for model permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_agent_count: int


async def resolve_model_permissions_context(
    conn: asyncpg.Connection,
    model_id: UUID,
) -> ModelPermissionsContext:
    """Fetch just what's needed for model permission checks.

    Two black-box tool calls:
      1. get_model_artifacts → department_ids + model_ids (resource IDs)
      2. search_agents(model_ids=...) → any active agents using this model?
    """
    artifacts = await get_model_artifacts(
        conn,
        [model_id],
        departments=True,
        models=True,
    )

    if not artifacts:
        return ModelPermissionsContext(
            exists=False,
            department_ids=[],
            active_agent_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    model_resource_ids = list(artifact.model_ids or [])

    active_agent_ids = (
        await search_agents(
            conn,
            model_ids=model_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if model_resource_ids
        else []
    )

    return ModelPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_agent_count=len(active_agent_ids),
    )
