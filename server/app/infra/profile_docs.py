"""Profile docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — profile_artifact table + CRUD operations
  3. Entry tool docs — profile_drafts MV, tables, operations
  4. Resource tool docs — all linked resources (names, emails, etc.)
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
from app.routes.v5.tools.artifacts.profile.docs import get_profile_docs

# Entry tool docs
from app.routes.v5.tools.entries.profile_drafts.docs import get_profile_drafts_docs

# Resource tool docs
from app.routes.v5.tools.resources.departments.docs import get_departments_docs
from app.routes.v5.tools.resources.emails.docs import get_emails_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.request_limits.docs import get_request_limits_docs
from app.routes.v5.tools.resources.roles.docs import get_roles_docs


async def docs_profile_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Profile docs using composable infra functions.

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
        emails,
        flags,
        departments,
        request_limits,
        roles,
    ) = await asyncio.gather(
        get_profile_docs(conn),
        get_profile_drafts_docs(conn),
        get_names_docs(conn),
        get_emails_docs(conn),
        get_flags_docs(conn),
        get_departments_docs(conn),
        get_request_limits_docs(conn),
        get_roles_docs(conn),
    )

    # ── Step 3: Assemble response ──────────────────────────────────────

    # Lazy imports to avoid circular dependencies
    from app.infra.profile_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.profile.create import create_profile
    from app.routes.v5.api.main.profile.delete import delete_profile
    from app.routes.v5.api.main.profile.draft import patch_profile_draft
    from app.routes.v5.api.main.profile.duplicate import duplicate_profile
    from app.routes.v5.api.main.profile.export import export_profiles
    from app.routes.v5.api.main.profile.get import get_profile
    from app.routes.v5.api.main.profile.save import save_profile
    from app.routes.v5.api.main.profile.search import search_profile
    from app.routes.v5.api.main.profile.update import update_profile

    return ComposedDocsResponse(
        name="profile",
        type="artifact",
        description=(
            "Profiles define user accounts and permissions. "
            "Each profile links to resources (names, departments, emails, "
            "flags, request_limits, roles) via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            emails,
            flags,
            departments,
            request_limits,
            roles,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the profile.",
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
                get_profile,
                description="POST /get — Get a single profile by ID with hydrated resources.",
            ),
            get_operation_info(
                search_profile,
                description="POST /search — Paginated profile search with filters.",
            ),
            get_operation_info(
                create_profile,
                description="POST /create — Create a new profile artifact.",
            ),
            get_operation_info(
                update_profile,
                description="POST /update — Update an existing profile's resource links.",
            ),
            get_operation_info(
                save_profile,
                description="POST /save — Create or update a profile (unified save).",
            ),
            get_operation_info(
                duplicate_profile,
                description="POST /duplicate — Duplicate an existing profile.",
            ),
            get_operation_info(
                delete_profile,
                description="POST /delete — Delete a profile.",
            ),
            get_operation_info(
                patch_profile_draft,
                description="PATCH /draft — Create or patch a profile draft (autosave).",
            ),
            get_operation_info(
                export_profiles,
                description="POST /export — Export profiles as denormalized CSV.",
            ),
        ],
    )
