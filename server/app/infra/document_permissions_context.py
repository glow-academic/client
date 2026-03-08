"""Document permissions context + shared save helpers.

Permissions context:
  1. resolve_document_permissions_context — lightweight access + edit check

Shared save helpers (used by both create and update):
  2. resolve_document_values — raw string → resource ID resolution
  3. create_denormalized_snapshot — hydrate IDs → documents_resource snapshot

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.routes.v5.tools.artifacts.document.get import (
    get_documents as get_document_artifacts,
)
from app.routes.v5.tools.artifacts.scenario.search import search_scenarios
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.documents.create import (
    create_document as create_document_resource,
)
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names

if TYPE_CHECKING:
    from app.routes.v5.api.main.document.types import (
        CreateDocumentItem,
        DocumentFieldError,
        UpdateDocumentItem,
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

    _, total = (
        await search_scenarios(
            conn,
            document_ids=document_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if document_resource_ids
        else ([], 0)
    )

    return DocumentPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_scenario_count=total,
    )


# ---------------------------------------------------------------------------
# Shared save helpers — used by both document_create and document_update
# ---------------------------------------------------------------------------


async def resolve_document_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: CreateDocumentItem | UpdateDocumentItem,
    is_create: bool,
) -> list[DocumentFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments, flags):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.document.types import DocumentFieldError

    errors: list[DocumentFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    # --- Match resources ---

    if item.is_inactive is not None and item.flag_id is None:
        results = await search_flags(
            conn,
            redis,
            search=None,
            flag_type="document_active",
            limit_count=1000,
            document=True,
        )
        match = next((f for f in results if f.type == "document_active"), None)
        if match and match.id:
            if not item.is_inactive:
                # Active → set the document_active flag
                item.flag_id = match.id
            # Inactive → leave flag_id as None (no flag)
        elif not item.is_inactive:
            errors.append(
                DocumentFieldError(
                    field="is_inactive", message="Active flag resource not found"
                )
            )

    if item.departments is not None and item.department_ids is None:
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            document=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    DocumentFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    # --- Validate required fields (create only) ---

    if is_create:
        if item.name_id is None:
            errors.append(DocumentFieldError(field="name", message="Name is required"))

    return errors


async def create_denormalized_snapshot(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    id: UUID | None = None,
    name_id: UUID | None,
    description_id: UUID | None,
) -> UUID:
    """Create a documents_resource snapshot by hydrating IDs to values."""

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_document_resource(
        conn,
        redis,
        id=id,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
    )
    return result.id
