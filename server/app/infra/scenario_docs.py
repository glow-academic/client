"""Scenario docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — scenario_artifact table + CRUD operations
  3. Entry tool docs — scenario_drafts MV, tables, operations
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
from app.routes.v5.tools.artifacts.scenario.docs import get_scenario_docs

# Entry tool docs
from app.routes.v5.tools.entries.scenario_drafts.docs import get_scenario_drafts_docs

# Resource tool docs
from app.routes.v5.tools.resources.departments.docs import get_departments_docs
from app.routes.v5.tools.resources.descriptions.docs import get_descriptions_docs
from app.routes.v5.tools.resources.documents.docs import get_documents_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.images.docs import get_images_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.objectives.docs import get_objectives_docs
from app.routes.v5.tools.resources.options.docs import get_options_docs
from app.routes.v5.tools.resources.parameter_fields.docs import (
    get_parameter_fields_docs,
)
from app.routes.v5.tools.resources.parameters.docs import get_parameters_docs
from app.routes.v5.tools.resources.personas.docs import get_personas_docs
from app.routes.v5.tools.resources.problem_statements.docs import (
    get_problem_statements_docs,
)
from app.routes.v5.tools.resources.questions.docs import get_questions_docs
from app.routes.v5.tools.resources.videos.docs import get_videos_docs


async def docs_scenario_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Scenario docs using composable infra functions.

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
        documents,
        flags,
        images,
        objectives,
        options,
        parameter_fields,
        parameters,
        personas,
        problem_statements,
        questions,
        videos,
    ) = await asyncio.gather(
        get_scenario_docs(conn),
        get_scenario_drafts_docs(conn),
        get_names_docs(conn),
        get_descriptions_docs(conn),
        get_departments_docs(conn),
        get_documents_docs(conn),
        get_flags_docs(conn),
        get_images_docs(conn),
        get_objectives_docs(conn),
        get_options_docs(conn),
        get_parameter_fields_docs(conn),
        get_parameters_docs(conn),
        get_personas_docs(conn),
        get_problem_statements_docs(conn),
        get_questions_docs(conn),
        get_videos_docs(conn),
    )

    # -- Step 3: Assemble response ---------------------------------------------

    # Lazy imports to avoid circular dependencies
    from app.infra.scenario_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.scenario.create import create_scenario
    from app.routes.v5.api.main.scenario.delete import delete_scenario
    from app.routes.v5.api.main.scenario.draft import patch_scenario_draft
    from app.routes.v5.api.main.scenario.duplicate import duplicate_scenario
    from app.routes.v5.api.main.scenario.export import export_scenarios
    from app.routes.v5.api.main.scenario.get import get_scenario
    from app.routes.v5.api.main.scenario.save import save_scenario
    from app.routes.v5.api.main.scenario.search import search_scenario
    from app.routes.v5.api.main.scenario.update import update_scenario

    return ComposedDocsResponse(
        name="scenario",
        type="artifact",
        description=(
            "Scenarios define simulation content and configuration. "
            "Each scenario links to resources (names, descriptions, departments, "
            "documents, flags, images, objectives, options, parameter_fields, "
            "parameters, personas, problem_statements, questions, videos) "
            "via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            descriptions,
            departments,
            documents,
            flags,
            images,
            objectives,
            options,
            parameter_fields,
            parameters,
            personas,
            problem_statements,
            questions,
            videos,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the scenario.",
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
                get_scenario,
                description="POST /get — Get a single scenario by ID with hydrated resources.",
            ),
            get_operation_info(
                search_scenario,
                description="POST /search — Paginated scenario search with filters.",
            ),
            get_operation_info(
                create_scenario,
                description="POST /create — Create a new scenario artifact.",
            ),
            get_operation_info(
                update_scenario,
                description="POST /update — Update an existing scenario's resource links.",
            ),
            get_operation_info(
                save_scenario,
                description="POST /save — Create or update a scenario (unified save).",
            ),
            get_operation_info(
                duplicate_scenario,
                description="POST /duplicate — Duplicate an existing scenario.",
            ),
            get_operation_info(
                delete_scenario,
                description="POST /delete — Delete a scenario.",
            ),
            get_operation_info(
                patch_scenario_draft,
                description="PATCH /draft — Create or patch a scenario draft (autosave).",
            ),
            get_operation_info(
                export_scenarios,
                description="POST /export — Export scenarios as denormalized CSV.",
            ),
        ],
    )
