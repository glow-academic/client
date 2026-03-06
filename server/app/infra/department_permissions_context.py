"""Resolve department permissions context — lightweight access + edit check.

Given a department_id, fetches just the data needed for permission checks:
  1. get_departments → exists check
  2. Count usage across junction tables → usage_count for edit permission

Department is special: it IS a department, so there are no parent department_ids
for access control. Access is role-based only (member+).
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.department.get import (
    get_departments as get_department_artifacts,
)


@dataclass(frozen=True)
class DepartmentPermissionsContext:
    """Lightweight context for department permission checks."""

    exists: bool
    usage_count: int


async def resolve_department_permissions_context(
    conn: asyncpg.Connection,
    department_id: UUID,
) -> DepartmentPermissionsContext:
    """Fetch just what's needed for department permission checks.

    Steps:
      1. get_department_artifacts → exists check
      2. Count usage across profile/simulation/scenario/persona/document/cohort junctions
    """
    artifacts = await get_department_artifacts(conn, [department_id])

    if not artifacts:
        return DepartmentPermissionsContext(
            exists=False,
            usage_count=0,
        )

    # Count how many artifacts reference this department across all junction tables
    usage_count = await conn.fetchval(
        """
        SELECT (
            (SELECT COUNT(*) FROM profile_departments_junction WHERE department_id = $1 AND active = true) +
            (SELECT COUNT(*) FROM simulation_departments_junction WHERE department_id = $1 AND active = true) +
            (SELECT COUNT(*) FROM scenario_departments_junction WHERE department_id = $1 AND active = true) +
            (SELECT COUNT(*) FROM persona_departments_junction WHERE department_id = $1 AND active = true) +
            (SELECT COUNT(*) FROM document_departments_junction WHERE department_id = $1 AND active = true) +
            (SELECT COUNT(*) FROM cohort_departments_junction WHERE department_id = $1 AND active = true)
        )::bigint
        """,
        department_id,
    )

    return DepartmentPermissionsContext(
        exists=True,
        usage_count=usage_count or 0,
    )
