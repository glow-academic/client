"""Resolve scenario permissions context — lightweight access + edit check.

Given a scenario_id, fetches just the data needed for permission checks:
  1. get_scenario_artifacts → department_ids + scenario_ids (resource IDs)
  2. search_simulations → any active simulations using this scenario?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.scenario.get import (
    get_scenarios as get_scenario_artifacts,
)
from app.routes.v5.tools.artifacts.simulation.search import search_simulations


@dataclass(frozen=True)
class ScenarioPermissionsContext:
    """Lightweight context for scenario permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_simulation_count: int


async def resolve_scenario_permissions_context(
    conn: asyncpg.Connection,
    scenario_id: UUID,
) -> ScenarioPermissionsContext:
    """Fetch just what's needed for scenario permission checks.

    Two black-box tool calls:
      1. get_scenario_artifacts → department_ids + scenario_ids (resource IDs)
      2. search_simulations → any active simulations using this scenario?
    """
    artifacts = await get_scenario_artifacts(
        conn,
        [scenario_id],
        departments=True,
        scenarios=True,
    )

    if not artifacts:
        return ScenarioPermissionsContext(
            exists=False,
            department_ids=[],
            active_simulation_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    scenario_resource_ids = list(artifact.scenario_ids or [])

    active_simulation_ids = (
        await search_simulations(
            conn,
            scenario_ids=scenario_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if scenario_resource_ids
        else []
    )

    return ScenarioPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_simulation_count=len(active_simulation_ids),
    )
