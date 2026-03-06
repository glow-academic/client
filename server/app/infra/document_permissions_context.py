"""Resolve document permissions context — lightweight access + edit check.

Given a document_id, fetches just the data needed for permission checks:
  1. get_documents → department_ids
  2. scenario_documents_junction count → active_scenario_count

Composes existing black-box fetchers — no raw SQL (except junction count).
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.document.get import (
    get_documents as get_document_artifacts,
)


@dataclass(frozen=True)
class DocumentPermissionsContext:
    """Lightweight context for document permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_scenario_count: int


async def resolve_document_permissions_context(
    conn: asyncpg.Connection,
    document_id: UUID,
) -> DocumentPermissionsContext:
    """Fetch just what's needed for document permission checks.

    Two queries:
      1. get_document_artifacts → department_ids
      2. scenario_documents_junction → active_scenario_count
    """
    artifacts = await get_document_artifacts(
        conn,
        [document_id],
        departments=True,
    )

    if not artifacts:
        return DocumentPermissionsContext(
            exists=False,
            department_ids=[],
            active_scenario_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])

    # Count active scenarios referencing this document
    active_scenario_count = await conn.fetchval(
        """
        SELECT COUNT(*)::int
        FROM scenario_documents_junction
        WHERE documents_id = $1 AND active = true
        """,
        document_id,
    )

    return DocumentPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_scenario_count=active_scenario_count or 0,
    )
