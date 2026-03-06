"""Resolve rubric permissions context — lightweight access + edit check.

Given a rubric_id, fetches just the data needed for permission checks:
  1. get_rubrics → department_ids
  2. Raw SQL → active simulation count (complex join through scenario_rubrics)

Composes existing black-box fetchers — no raw SQL where possible.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.rubric.get import (
    get_rubrics as get_rubric_artifacts,
)


@dataclass(frozen=True)
class RubricPermissionsContext:
    """Lightweight context for rubric permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_simulation_count: int


async def resolve_rubric_permissions_context(
    conn: asyncpg.Connection,
    rubric_id: UUID,
) -> RubricPermissionsContext:
    """Fetch just what's needed for rubric permission checks.

    Two calls:
      1. get_rubric_artifacts → department_ids
      2. SQL count → active simulations using this rubric
    """
    artifacts = await get_rubric_artifacts(
        conn,
        [rubric_id],
        departments=True,
    )

    if not artifacts:
        return RubricPermissionsContext(
            exists=False,
            department_ids=[],
            active_simulation_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    # Count active simulations using this rubric via scenario_rubrics_resource.
    # This replicates the SQL from get_rubric_access_complete.sql.
    row = await conn.fetchval(
        """
        SELECT COUNT(DISTINCT ss.simulation_id)::int
        FROM simulation_scenarios_junction ss
        JOIN simulation_scenario_rubrics_junction ssr
            ON ssr.simulation_id = ss.simulation_id
        JOIN scenario_rubrics_resource srr
            ON srr.id = ssr.scenario_rubrics_id
            AND srr.scenario_id = ss.scenarios_id
        WHERE srr.rubric_id = $1
          AND EXISTS (
              SELECT 1 FROM simulation_scenario_flags_junction ssf
              JOIN scenario_flags_resource sfr ON ssf.scenario_flags_id = sfr.id
              JOIN flags_resource f ON sfr.flag_id = f.id
              WHERE ssf.simulation_id = ss.simulation_id
                AND sfr.scenario_id = ss.scenarios_id
                AND f.type = 'scenario_active'
                AND f.value = true
          )
        """,
        rubric_id,
    )

    return RubricPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_simulation_count=row or 0,
    )
