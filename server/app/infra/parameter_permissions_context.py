"""Resolve parameter permissions context — lightweight access + edit check.

Given a parameter_id, fetches just the data needed for permission checks:
  1. get_parameters → department_ids
  2. search_scenarios → any active scenarios using this parameter's fields?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.parameter.get import (
    get_parameters as get_parameter_artifacts,
)
from app.routes.v5.tools.artifacts.scenario.search import search_scenarios


@dataclass(frozen=True)
class ParameterPermissionsContext:
    """Lightweight context for parameter permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_scenario_count: int


async def resolve_parameter_permissions_context(
    conn: asyncpg.Connection,
    parameter_id: UUID,
) -> ParameterPermissionsContext:
    """Fetch just what's needed for parameter permission checks.

    Two black-box tool calls:
      1. get_parameter_artifacts → department_ids
      2. search_scenarios(parameter_ids=...) → any active scenarios?
    """
    artifacts = await get_parameter_artifacts(
        conn,
        [parameter_id],
        departments=True,
    )

    if not artifacts:
        return ParameterPermissionsContext(
            exists=False,
            department_ids=[],
            active_scenario_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    active_scenario_ids = await search_scenarios(
        conn,
        parameter_ids=[parameter_id],
        active_only=True,
        limit_count=1,
    )

    return ParameterPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_scenario_count=len(active_scenario_ids),
    )
