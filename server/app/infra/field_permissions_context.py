"""Resolve field permissions context — lightweight access check.

Given a field_id, fetches just the data needed for permission checks:
  1. get_fields → exists + department_ids + field_ids (resource IDs)
  2. search_parameters (artifact) → active_parameter_count

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.field.get import get_fields as get_field_artifacts
from app.routes.v5.tools.artifacts.parameter.search import (
    search_parameters as search_parameter_artifacts,
)


@dataclass(frozen=True)
class FieldPermissionsContext:
    """Lightweight context for field permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_parameter_count: int


async def resolve_field_permissions_context(
    conn: asyncpg.Connection,
    field_id: UUID,
) -> FieldPermissionsContext:
    """Fetch just what's needed for field permission checks.

    Two black-box tool calls:
      1. get_field_artifacts → department_ids, field_ids (resource IDs)
      2. search_parameters(field_ids=...) → count of active parameters using this field
    """
    artifacts = await get_field_artifacts(
        conn,
        [field_id],
        departments=True,
        fields=True,
    )

    if not artifacts:
        return FieldPermissionsContext(
            exists=False,
            department_ids=[],
            active_parameter_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    field_resource_ids = list(artifact.field_ids or [])

    # Count active parameters referencing this field's resource IDs
    active_parameter_count = 0
    if field_resource_ids:
        _, total = await search_parameter_artifacts(
            conn,
            field_ids=field_resource_ids,
            active_only=True,
            limit_count=1,
        )
        active_parameter_count = total

    return FieldPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_parameter_count=active_parameter_count,
    )
