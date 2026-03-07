"""Resolve simulation permissions context — lightweight access + edit check.

Given a simulation_id, fetches just the data needed for permission checks:
  1. get_simulations → department_ids + simulation_ids (resource IDs)
  2. search_cohorts → any active cohorts using this simulation?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.cohort.search import search_cohorts
from app.routes.v5.tools.artifacts.simulation.get import (
    get_simulations as get_simulation_artifacts,
)


@dataclass(frozen=True)
class SimulationPermissionsContext:
    """Lightweight context for simulation permission checks."""

    exists: bool
    department_ids: list[UUID]
    cohort_usage_count: int


async def resolve_simulation_permissions_context(
    conn: asyncpg.Connection,
    simulation_id: UUID,
) -> SimulationPermissionsContext:
    """Fetch just what's needed for simulation permission checks.

    Two black-box tool calls:
      1. get_simulation_artifacts → department_ids + simulation_ids (resource IDs)
      2. search_cohorts → any active cohorts using this simulation?
    """
    artifacts = await get_simulation_artifacts(
        conn,
        [simulation_id],
        departments=True,
        simulations=True,
    )

    if not artifacts:
        return SimulationPermissionsContext(
            exists=False,
            department_ids=[],
            cohort_usage_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    simulation_resource_ids = list(artifact.simulation_ids or [])

    active_cohort_ids = (
        await search_cohorts(
            conn,
            simulation_ids=simulation_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if simulation_resource_ids
        else []
    )

    return SimulationPermissionsContext(
        exists=True,
        department_ids=department_ids,
        cohort_usage_count=len(active_cohort_ids),
    )
