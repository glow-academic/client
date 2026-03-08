"""Parameter docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — parameter_artifact table + CRUD operations
  3. Entry tool docs — parameter_drafts MV, tables, operations
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
from app.routes.v5.tools.artifacts.parameter.docs import get_parameter_docs

# Entry tool docs
from app.routes.v5.tools.entries.parameter_drafts.docs import get_parameter_drafts_docs

# Resource tool docs
from app.routes.v5.tools.resources.departments.docs import get_departments_docs
from app.routes.v5.tools.resources.descriptions.docs import get_descriptions_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.parameter_fields.docs import (
    get_parameter_fields_docs,
)


async def docs_parameter_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Parameter docs using composable infra functions.

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
        departments,
        parameter_fields,
    ) = await asyncio.gather(
        get_parameter_docs(conn),
        get_parameter_drafts_docs(conn),
        get_names_docs(conn),
        get_descriptions_docs(conn),
        get_flags_docs(conn),
        get_departments_docs(conn),
        get_parameter_fields_docs(conn),
    )

    # ── Step 3: Assemble response ──────────────────────────────────────

    # Lazy imports to avoid circular dependencies
    from app.routes.v5.api.main.parameter.create import create_parameter
    from app.routes.v5.api.main.parameter.delete import delete_parameter
    from app.routes.v5.api.main.parameter.draft import patch_parameter_draft
    from app.routes.v5.api.main.parameter.duplicate import duplicate_parameter
    from app.routes.v5.api.main.parameter.export import export_parameters
    from app.routes.v5.api.main.parameter.get import get_parameter
    from app.infra.parameter_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.parameter.save import save_parameter
    from app.routes.v5.api.main.parameter.search import search_parameter
    from app.routes.v5.api.main.parameter.update import update_parameter

    return ComposedDocsResponse(
        name="parameter",
        type="artifact",
        description=(
            "Parameters define configurable parameter sets. "
            "Each parameter links to resources (names, descriptions, departments, "
            "flags, parameter_fields) via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            descriptions,
            flags,
            departments,
            parameter_fields,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the parameter.",
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
                get_parameter,
                description="POST /get — Get a single parameter by ID with hydrated resources.",
            ),
            get_operation_info(
                search_parameter,
                description="POST /search — Paginated parameter search with filters.",
            ),
            get_operation_info(
                create_parameter,
                description="POST /create — Create a new parameter artifact.",
            ),
            get_operation_info(
                update_parameter,
                description="POST /update — Update an existing parameter's resource links.",
            ),
            get_operation_info(
                save_parameter,
                description="POST /save — Create or update a parameter (unified save).",
            ),
            get_operation_info(
                duplicate_parameter,
                description="POST /duplicate — Duplicate an existing parameter.",
            ),
            get_operation_info(
                delete_parameter,
                description="POST /delete — Delete a parameter.",
            ),
            get_operation_info(
                patch_parameter_draft,
                description="PATCH /draft — Create or patch a parameter draft (autosave).",
            ),
            get_operation_info(
                export_parameters,
                description="POST /export — Export parameters as denormalized CSV.",
            ),
        ],
    )
