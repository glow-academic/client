"""Auth docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — auth_artifact table + CRUD operations
  3. Entry tool docs — auth_drafts MV, tables, operations
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
from app.routes.v5.tools.artifacts.auth.docs import get_auth_docs
from app.routes.v5.tools.artifacts.auth.get import get_auths as get_auth_artifacts

# Entry tool docs
from app.routes.v5.tools.entries.auth_drafts.docs import get_auth_drafts_docs

# Resource tool docs
from app.routes.v5.tools.resources.departments.docs import get_departments_docs
from app.routes.v5.tools.resources.descriptions.docs import get_descriptions_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.items.docs import get_items_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.protocols.docs import get_protocols_docs
from app.routes.v5.tools.resources.slugs.docs import get_slugs_docs

# Name hydration
from app.routes.v5.tools.resources.names.get import get_names
from app.utils.docs_helper import PageMetadataConfig, compute_docs_metadata

_PAGE_METADATA = PageMetadataConfig(
    list_title="Auth Providers",
    list_description="Manage authentication provider configurations.",
    detail_title="— Auth Provider",
    detail_description="View and edit auth provider configuration and linked resources.",
    new_title="New Auth Provider",
    new_description="Create a new auth provider.",
)


async def _resolve_entity_name(
    conn: asyncpg.Connection,
    redis: Redis,
    entity_id: UUID,
) -> str | None:
    """Get display name for an auth by ID using black-box tools."""
    artifacts = await get_auth_artifacts(conn, [entity_id], names=True)
    if not artifacts or not artifacts[0].name_ids:
        return None
    names_data = await get_names(conn, artifacts[0].name_ids, redis)
    return names_data[0].name if names_data else None


async def docs_auth_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
) -> ComposedDocsResponse:
    """Auth docs using composable infra functions.

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
        departments,
        flags,
        items,
        protocols,
        slugs,
    ) = await asyncio.gather(
        get_auth_docs(conn),
        get_auth_drafts_docs(conn),
        get_names_docs(conn),
        get_descriptions_docs(conn),
        get_departments_docs(conn),
        get_flags_docs(conn),
        get_items_docs(conn),
        get_protocols_docs(conn),
        get_slugs_docs(conn),
    )

    # ── Step 3: Page metadata ───────────────────────────────────────────
    entity_name = None
    if entity_id is not None:
        entity_name = await _resolve_entity_name(conn, redis, entity_id)
    page_metadata = compute_docs_metadata(_PAGE_METADATA, entity_name)

    # ── Step 4: Assemble response ──────────────────────────────────────

    # Lazy imports to avoid circular dependencies
    from app.infra.auth_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.auth.create import create_auth
    from app.routes.v5.api.main.auth.delete import delete_auth
    from app.routes.v5.api.main.auth.draft import patch_auth_draft
    from app.routes.v5.api.main.auth.duplicate import duplicate_auth
    from app.routes.v5.api.main.auth.export import export_auths
    from app.routes.v5.api.main.auth.get import get_auth
    from app.routes.v5.api.main.auth.save import save_auth
    from app.routes.v5.api.main.auth.search import search_auth
    from app.routes.v5.api.main.auth.update import update_auth

    return ComposedDocsResponse(
        name="auth",
        type="artifact",
        description=(
            "Auth providers define authentication configurations. "
            "Each auth links to resources (names, descriptions, departments, "
            "flags, items, protocols, slugs) via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            descriptions,
            departments,
            flags,
            items,
            protocols,
            slugs,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the auth.",
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
                get_auth,
                description="POST /get — Get a single auth by ID with hydrated resources.",
            ),
            get_operation_info(
                search_auth,
                description="POST /search — Paginated auth search with filters.",
            ),
            get_operation_info(
                create_auth,
                description="POST /create — Create a new auth artifact.",
            ),
            get_operation_info(
                update_auth,
                description="POST /update — Update an existing auth's resource links.",
            ),
            get_operation_info(
                save_auth,
                description="POST /save — Create or update an auth (unified save).",
            ),
            get_operation_info(
                duplicate_auth,
                description="POST /duplicate — Duplicate an existing auth.",
            ),
            get_operation_info(
                delete_auth,
                description="POST /delete — Delete an auth.",
            ),
            get_operation_info(
                patch_auth_draft,
                description="PATCH /draft — Create or patch an auth draft (autosave).",
            ),
            get_operation_info(
                export_auths,
                description="POST /export — Export auths as denormalized CSV.",
            ),
        ],
        page_metadata=page_metadata,
    )
