"""Department docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — department_artifact table + CRUD operations
  3. Entry tool docs — department_drafts MV, tables, operations
  4. Resource tool docs — all linked resources (names, descriptions, etc.)
  5. Permission functions — introspected via get_operation_info
  6. API operations — all public route handlers introspected
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.types import ComposedDocsResponse
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tool docs
from app.routes.v5.tools.artifacts.department.docs import get_department_docs

# Entry tool docs
from app.routes.v5.tools.entries.department_drafts.docs import (
    get_department_drafts_docs,
)

# Resource tool docs
from app.routes.v5.tools.resources.descriptions.docs import get_descriptions_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.settings.docs import get_settings_docs


async def docs_department_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Department docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → profile check
      2. Parallel: artifact docs + entry docs + all resource docs
      3. Assemble ComposedDocsResponse with permissions + API operations
    """
    from fastapi import HTTPException

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Parallel docs fetches ──────────────────────────────────

    (
        artifact,
        drafts,
        names,
        descriptions,
        flags,
        settings,
    ) = await asyncio.gather(
        get_department_docs(conn),
        get_department_drafts_docs(conn),
        get_names_docs(conn),
        get_descriptions_docs(conn),
        get_flags_docs(conn),
        get_settings_docs(conn),
    )

    # ── Step 3: Assemble response ──────────────────────────────────────

    # Lazy imports to avoid circular dependencies
    from app.routes.v5.api.main.department.create import create_department
    from app.routes.v5.api.main.department.delete import delete_department
    from app.routes.v5.api.main.department.draft import patch_department_draft
    from app.routes.v5.api.main.department.duplicate import duplicate_department
    from app.routes.v5.api.main.department.export import export_departments
    from app.routes.v5.api.main.department.get import get_department
    from app.infra.department_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.department.save import save_department
    from app.routes.v5.api.main.department.search import search_department
    from app.routes.v5.api.main.department.update import update_department

    return ComposedDocsResponse(
        name="department",
        type="artifact",
        description=(
            "Departments define organizational units. "
            "Each department links to resources (names, descriptions, "
            "flags, settings) via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            descriptions,
            flags,
            settings,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the department.",
            ),
            get_operation_info(
                compute_can_edit,
                description="Unified edit permission for UI and save enforcement.",
            ),
            get_operation_info(
                compute_can_delete,
                description="Delete permission — same as edit + usage check.",
            ),
            get_operation_info(
                compute_can_duplicate,
                description="Duplicate — role-only check.",
            ),
            get_operation_info(
                compute_can_create,
                description="Create new artifact — role + department check.",
            ),
            get_operation_info(
                compute_can_draft,
                description="Draft — role-only check.",
            ),
        ],
        api_operations=[
            get_operation_info(
                get_department,
                description="POST /get — Get a single department by ID with hydrated resources.",
            ),
            get_operation_info(
                search_department,
                description="POST /search — Paginated department search with filters.",
            ),
            get_operation_info(
                create_department,
                description="POST /create — Create a new department artifact.",
            ),
            get_operation_info(
                update_department,
                description="POST /update — Update an existing department's resource links.",
            ),
            get_operation_info(
                save_department,
                description="POST /save — Create or update a department (unified save).",
            ),
            get_operation_info(
                duplicate_department,
                description="POST /duplicate — Duplicate an existing department.",
            ),
            get_operation_info(
                delete_department,
                description="POST /delete — Delete a department.",
            ),
            get_operation_info(
                patch_department_draft,
                description="PATCH /draft — Create or patch a department draft (autosave).",
            ),
            get_operation_info(
                export_departments,
                description="POST /export — Export departments as denormalized CSV.",
            ),
        ],
    )
