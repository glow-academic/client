"""Resolve document permissions context — lightweight access + edit check.

Given a document_id, fetches just the data needed for permission checks:
  1. get_documents → department_ids + document_ids (resource IDs)
  2. search_scenarios → any active scenarios using this document?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.document.get import (
    get_documents as get_document_artifacts,
)
from app.routes.v5.tools.artifacts.scenario.search import search_scenarios


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

    Two black-box tool calls:
      1. get_document_artifacts → department_ids + document_ids (resource IDs)
      2. search_scenarios → any active scenarios using this document?
    """
    artifacts = await get_document_artifacts(
        conn,
        [document_id],
        departments=True,
        documents=True,
    )

    if not artifacts:
        return DocumentPermissionsContext(
            exists=False,
            department_ids=[],
            active_scenario_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    document_resource_ids = list(artifact.document_ids or [])

    active_scenario_ids = (
        await search_scenarios(
            conn,
            document_ids=document_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if document_resource_ids
        else []
    )

    return DocumentPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_scenario_count=len(active_scenario_ids),
    )
