"""Provider docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — provider_artifact table + CRUD operations
  3. Entry tool docs — provider_drafts MV, tables, operations
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
from app.routes.v5.tools.artifacts.provider.docs import get_provider_docs

# Entry tool docs
from app.routes.v5.tools.entries.provider_drafts.docs import get_provider_drafts_docs

# Resource tool docs
from app.routes.v5.tools.resources.departments.docs import get_departments_docs
from app.routes.v5.tools.resources.descriptions.docs import get_descriptions_docs
from app.routes.v5.tools.resources.endpoints.docs import get_endpoints_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.keys.docs import get_keys_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.values.docs import get_values_docs


async def docs_provider_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Provider docs using composable infra functions.

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
        endpoints,
        keys,
        values,
    ) = await asyncio.gather(
        get_provider_docs(conn),
        get_provider_drafts_docs(conn),
        get_names_docs(conn),
        get_descriptions_docs(conn),
        get_flags_docs(conn),
        get_departments_docs(conn),
        get_endpoints_docs(conn),
        get_keys_docs(conn),
        get_values_docs(conn),
    )

    # ── Step 3: Assemble response ──────────────────────────────────────

    # Lazy imports to avoid circular dependencies
    from app.infra.provider_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.provider.create import create_provider
    from app.routes.v5.api.main.provider.delete import delete_provider
    from app.routes.v5.api.main.provider.draft import patch_provider_draft
    from app.routes.v5.api.main.provider.duplicate import duplicate_provider
    from app.routes.v5.api.main.provider.export import export_providers
    from app.routes.v5.api.main.provider.get import get_provider
    from app.routes.v5.api.main.provider.save import save_provider
    from app.routes.v5.api.main.provider.search import search_provider
    from app.routes.v5.api.main.provider.update import update_provider

    return ComposedDocsResponse(
        name="provider",
        type="artifact",
        description=(
            "Providers define AI service provider configurations. "
            "Each provider links to resources (names, descriptions, departments, "
            "endpoints, flags, keys, values) via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            descriptions,
            flags,
            departments,
            endpoints,
            keys,
            values,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the provider.",
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
                get_provider,
                description="POST /get — Get a single provider by ID with hydrated resources.",
            ),
            get_operation_info(
                search_provider,
                description="POST /search — Paginated provider search with filters.",
            ),
            get_operation_info(
                create_provider,
                description="POST /create — Create a new provider artifact.",
            ),
            get_operation_info(
                update_provider,
                description="POST /update — Update an existing provider's resource links.",
            ),
            get_operation_info(
                save_provider,
                description="POST /save — Create or update a provider (unified save).",
            ),
            get_operation_info(
                duplicate_provider,
                description="POST /duplicate — Duplicate an existing provider.",
            ),
            get_operation_info(
                delete_provider,
                description="POST /delete — Delete a provider.",
            ),
            get_operation_info(
                patch_provider_draft,
                description="PATCH /draft — Create or patch a provider draft (autosave).",
            ),
            get_operation_info(
                export_providers,
                description="POST /export — Export providers as denormalized CSV.",
            ),
        ],
    )
