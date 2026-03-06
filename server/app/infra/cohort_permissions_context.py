"""Resolve cohort permissions context — lightweight access + edit check.

Given a cohort_id, fetches just the data needed for permission checks:
  1. get_cohorts → department_ids (resource IDs)

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.cohort.get import (
    get_cohorts as get_cohort_artifacts,
)


@dataclass(frozen=True)
class CohortPermissionsContext:
    """Lightweight context for cohort permission checks."""

    exists: bool
    department_ids: list[UUID]


async def resolve_cohort_permissions_context(
    conn: asyncpg.Connection,
    cohort_id: UUID,
) -> CohortPermissionsContext:
    """Fetch just what's needed for cohort permission checks.

    Single black-box tool call:
      1. get_cohort_artifacts → department_ids
    """
    artifacts = await get_cohort_artifacts(
        conn,
        [cohort_id],
        departments=True,
    )

    if not artifacts:
        return CohortPermissionsContext(
            exists=False,
            department_ids=[],
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    return CohortPermissionsContext(
        exists=True,
        department_ids=department_ids,
    )
