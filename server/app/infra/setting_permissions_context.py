"""Resolve setting permissions context — lightweight access + edit check.

Given a setting_id, fetches just the data needed for permission checks:
  1. get_settings → department_ids (for access + edit)

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.setting.get import (
    get_settings as get_setting_artifacts,
)


@dataclass(frozen=True)
class SettingPermissionsContext:
    """Lightweight context for setting permission checks."""

    exists: bool
    department_ids: list[UUID]


async def resolve_setting_permissions_context(
    conn: asyncpg.Connection,
    setting_id: UUID,
) -> SettingPermissionsContext:
    """Fetch just what's needed for setting permission checks.

    Single black-box tool call:
      1. get_setting_artifacts → department_ids
    """
    artifacts = await get_setting_artifacts(
        conn,
        [setting_id],
        departments=True,
    )

    if not artifacts:
        return SettingPermissionsContext(
            exists=False,
            department_ids=[],
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    return SettingPermissionsContext(
        exists=True,
        department_ids=department_ids,
    )
