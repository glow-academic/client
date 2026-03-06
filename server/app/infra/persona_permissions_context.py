"""Resolve persona permissions context — lightweight access + edit check.

Given a persona_id, fetches just the data needed for permission checks:
  1. get_persona_artifacts → department_ids + persona_ids (resource IDs)
  2. search_scenarios → any active scenarios using this persona?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.persona.get import (
    get_personas as get_persona_artifacts,
)
from app.routes.v5.tools.artifacts.scenario.search import search_scenarios


@dataclass(frozen=True)
class PersonaPermissionsContext:
    """Lightweight context for persona permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_scenario_count: int


async def resolve_persona_permissions_context(
    conn: asyncpg.Connection,
    persona_id: UUID,
) -> PersonaPermissionsContext:
    """Fetch just what's needed for persona permission checks.

    Two black-box tool calls:
      1. get_persona_artifacts → department_ids + persona_ids (resource IDs)
      2. search_scenarios → any active scenarios using this persona?
    """
    artifacts = await get_persona_artifacts(
        conn,
        [persona_id],
        departments=True,
        personas=True,
    )

    if not artifacts:
        return PersonaPermissionsContext(
            exists=False,
            department_ids=[],
            active_scenario_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    personas_resource_ids = list(artifact.persona_ids or [])

    active_scenario_ids = (
        await search_scenarios(
            conn,
            persona_ids=personas_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if personas_resource_ids
        else []
    )

    return PersonaPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_scenario_count=len(active_scenario_ids),
    )
