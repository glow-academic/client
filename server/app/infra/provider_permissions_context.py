"""Resolve provider permissions context — lightweight access + edit check.

Given a provider_id, fetches just the data needed for permission checks:
  1. get_providers → department_ids
  2. search_models → any active models using this provider?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.model.search import search_models
from app.routes.v5.tools.artifacts.provider.get import (
    get_providers as get_provider_artifacts,
)


@dataclass(frozen=True)
class ProviderPermissionsContext:
    """Lightweight context for provider permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_model_count: int


async def resolve_provider_permissions_context(
    conn: asyncpg.Connection,
    provider_id: UUID,
) -> ProviderPermissionsContext:
    """Fetch just what's needed for provider permission checks.

    Two black-box tool calls:
      1. get_provider_artifacts → department_ids
      2. search_models(provider_ids=...) → any active models?
    """
    artifacts = await get_provider_artifacts(
        conn,
        [provider_id],
        departments=True,
    )

    if not artifacts:
        return ProviderPermissionsContext(
            exists=False,
            department_ids=[],
            active_model_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    active_model_ids = await search_models(
        conn,
        provider_ids=[provider_id],
        active_only=True,
        limit_count=1,
    )

    return ProviderPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_model_count=len(active_model_ids),
    )
