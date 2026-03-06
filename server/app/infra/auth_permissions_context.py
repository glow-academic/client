"""Resolve auth permissions context — lightweight access + edit check.

Given an auth_id, fetches just the data needed for permission checks:
  1. get_auths → department_ids

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.auth.get import (
    get_auths as get_auth_artifacts,
)


@dataclass(frozen=True)
class AuthPermissionsContext:
    """Lightweight context for auth permission checks."""

    exists: bool
    department_ids: list[UUID]


async def resolve_auth_permissions_context(
    conn: asyncpg.Connection,
    auth_id: UUID,
) -> AuthPermissionsContext:
    """Fetch just what's needed for auth permission checks.

    One black-box tool call:
      1. get_auth_artifacts → department_ids
    """
    artifacts = await get_auth_artifacts(
        conn,
        [auth_id],
        departments=True,
    )

    if not artifacts:
        return AuthPermissionsContext(
            exists=False,
            department_ids=[],
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    return AuthPermissionsContext(
        exists=True,
        department_ids=department_ids,
    )
