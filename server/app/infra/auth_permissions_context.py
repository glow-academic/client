"""Resolve auth permissions context — lightweight access + edit check.

Given an auth_id, fetches just the data needed for permission checks:
  1. get_auths → department_ids
  2. search_settings (artifact) → active_settings_count

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.auth.get import (
    get_auths as get_auth_artifacts,
)
from app.routes.v5.tools.artifacts.setting.search import (
    search_settings as search_setting_artifacts,
)


@dataclass(frozen=True)
class AuthPermissionsContext:
    """Lightweight context for auth permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_settings_count: int


async def resolve_auth_permissions_context(
    conn: asyncpg.Connection,
    auth_id: UUID,
) -> AuthPermissionsContext:
    """Fetch just what's needed for auth permission checks.

    Two black-box tool calls:
      1. get_auth_artifacts → department_ids, auth_ids (resource IDs)
      2. search_settings(auth_ids=...) → count of active settings referencing this auth
    """
    artifacts = await get_auth_artifacts(
        conn,
        [auth_id],
        departments=True,
        auths=True,
    )

    if not artifacts:
        return AuthPermissionsContext(
            exists=False,
            department_ids=[],
            active_settings_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    auth_resource_ids = list(artifact.auth_ids or [])

    # Count active settings referencing this auth's resource IDs
    active_settings_count = 0
    if auth_resource_ids:
        _, total = await search_setting_artifacts(
            conn,
            auth_ids=auth_resource_ids,
            active_only=True,
            limit_count=1,
        )
        active_settings_count = total

    return AuthPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_settings_count=active_settings_count,
    )
