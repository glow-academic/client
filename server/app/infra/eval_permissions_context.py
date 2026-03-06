"""Resolve eval permissions context — lightweight access check.

Given an eval_id, fetches just the data needed for permission checks:
  1. get_evals → department_ids

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.eval.get import get_evals as get_eval_artifacts


@dataclass(frozen=True)
class EvalPermissionsContext:
    """Lightweight context for eval permission checks."""

    exists: bool
    department_ids: list[UUID]


async def resolve_eval_permissions_context(
    conn: asyncpg.Connection,
    eval_id: UUID,
) -> EvalPermissionsContext:
    """Fetch just what's needed for eval permission checks.

    Single black-box tool call:
      1. get_eval_artifacts → department_ids
    """
    artifacts = await get_eval_artifacts(
        conn,
        [eval_id],
        departments=True,
    )

    if not artifacts:
        return EvalPermissionsContext(
            exists=False,
            department_ids=[],
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    return EvalPermissionsContext(
        exists=True,
        department_ids=department_ids,
    )
