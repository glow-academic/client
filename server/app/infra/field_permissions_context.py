"""Resolve field permissions context — lightweight access check.

Given a field_id, fetches just the data needed for permission checks:
  1. get_fields → exists + department_ids

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.field.get import get_fields as get_field_artifacts


@dataclass(frozen=True)
class FieldPermissionsContext:
    """Lightweight context for field permission checks."""

    exists: bool
    department_ids: list[UUID]


async def resolve_field_permissions_context(
    conn: asyncpg.Connection,
    field_id: UUID,
) -> FieldPermissionsContext:
    """Fetch just what's needed for field permission checks.

    Single black-box tool call:
      1. get_field_artifacts → department_ids
    """
    artifacts = await get_field_artifacts(
        conn,
        [field_id],
        departments=True,
    )

    if not artifacts:
        return FieldPermissionsContext(
            exists=False,
            department_ids=[],
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    return FieldPermissionsContext(
        exists=True,
        department_ids=department_ids,
    )
