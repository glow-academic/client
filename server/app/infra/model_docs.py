"""Model docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — model_artifact table + CRUD operations
  3. Entry tool docs — model_drafts MV, tables, operations
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
from app.routes.v5.tools.artifacts.model.docs import get_model_docs

# Entry tool docs
from app.routes.v5.tools.entries.model_drafts.docs import get_model_drafts_docs

# Resource tool docs
from app.routes.v5.tools.resources.departments.docs import get_departments_docs
from app.routes.v5.tools.resources.descriptions.docs import get_descriptions_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.modalities.docs import get_modalities_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.pricing.docs import get_pricing_docs
from app.routes.v5.tools.resources.providers.docs import get_providers_docs
from app.routes.v5.tools.resources.qualities.docs import get_qualities_docs
from app.routes.v5.tools.resources.reasoning_levels.docs import (
    get_reasoning_levels_docs,
)
from app.routes.v5.tools.resources.temperature_levels.docs import (
    get_temperature_levels_docs,
)
from app.routes.v5.tools.resources.values.docs import get_values_docs
from app.routes.v5.tools.resources.voices.docs import get_voices_docs


async def docs_model_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Model docs using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> profile check
      2. Parallel: artifact docs + entry docs + all resource docs
      3. Assemble ComposedDocsResponse with permissions + API operations
    """
    from fastapi import HTTPException

    # -- Step 1: Profile context -----------------------------------------------

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Parallel docs fetches -----------------------------------------

    (
        artifact,
        drafts,
        names,
        descriptions,
        departments,
        flags,
        modalities,
        pricing,
        providers,
        qualities,
        reasoning_levels,
        temperature_levels,
        values,
        voices,
    ) = await asyncio.gather(
        get_model_docs(conn),
        get_model_drafts_docs(conn),
        get_names_docs(conn),
        get_descriptions_docs(conn),
        get_departments_docs(conn),
        get_flags_docs(conn),
        get_modalities_docs(conn),
        get_pricing_docs(conn),
        get_providers_docs(conn),
        get_qualities_docs(conn),
        get_reasoning_levels_docs(conn),
        get_temperature_levels_docs(conn),
        get_values_docs(conn),
        get_voices_docs(conn),
    )

    # -- Step 3: Assemble response ---------------------------------------------

    # Lazy imports to avoid circular dependencies
    from app.routes.v5.api.main.model.create import create_model
    from app.routes.v5.api.main.model.delete import delete_model
    from app.routes.v5.api.main.model.draft import patch_model_draft
    from app.routes.v5.api.main.model.duplicate import duplicate_model
    from app.routes.v5.api.main.model.export import export_models
    from app.routes.v5.api.main.model.get import get_model
    from app.infra.model_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.model.save import save_model
    from app.routes.v5.api.main.model.search import search_model
    from app.routes.v5.api.main.model.update import update_model

    return ComposedDocsResponse(
        name="model",
        type="artifact",
        description=(
            "Models define AI model configurations. "
            "Each model links to resources (names, descriptions, departments, "
            "flags, modalities, pricing, providers, qualities, reasoning_levels, "
            "temperature_levels, values, voices) "
            "via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            descriptions,
            departments,
            flags,
            modalities,
            pricing,
            providers,
            qualities,
            reasoning_levels,
            temperature_levels,
            values,
            voices,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the model.",
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
                get_model,
                description="POST /get — Get a single model by ID with hydrated resources.",
            ),
            get_operation_info(
                search_model,
                description="POST /search — Paginated model search with filters.",
            ),
            get_operation_info(
                create_model,
                description="POST /create — Create a new model artifact.",
            ),
            get_operation_info(
                update_model,
                description="POST /update — Update an existing model's resource links.",
            ),
            get_operation_info(
                save_model,
                description="POST /save — Create or update a model (unified save).",
            ),
            get_operation_info(
                duplicate_model,
                description="POST /duplicate — Duplicate an existing model.",
            ),
            get_operation_info(
                delete_model,
                description="POST /delete — Delete a model.",
            ),
            get_operation_info(
                patch_model_draft,
                description="PATCH /draft — Create or patch a model draft (autosave).",
            ),
            get_operation_info(
                export_models,
                description="POST /export — Export models as denormalized CSV.",
            ),
        ],
    )
