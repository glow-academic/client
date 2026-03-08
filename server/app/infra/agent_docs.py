"""Agent docs logic — composable infra architecture.

Composes existing black-box tool docs:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Artifact tool docs — agent_artifact table + CRUD operations
  3. Entry tool docs — agent_drafts MV, tables, operations
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
from app.routes.v5.tools.artifacts.agent.docs import get_agent_docs

# Entry tool docs
from app.routes.v5.tools.entries.agent_drafts.docs import get_agent_drafts_docs

# Resource tool docs
from app.routes.v5.tools.resources.departments.docs import get_departments_docs
from app.routes.v5.tools.resources.descriptions.docs import get_descriptions_docs
from app.routes.v5.tools.resources.flags.docs import get_flags_docs
from app.routes.v5.tools.resources.instructions.docs import get_instructions_docs
from app.routes.v5.tools.resources.models.docs import get_models_docs
from app.routes.v5.tools.resources.names.docs import get_names_docs
from app.routes.v5.tools.resources.prompts.docs import get_prompts_docs
from app.routes.v5.tools.resources.qualities.docs import get_qualities_docs
from app.routes.v5.tools.resources.reasoning_levels.docs import (
    get_reasoning_levels_docs,
)
from app.routes.v5.tools.resources.rubrics.docs import get_rubrics_docs
from app.routes.v5.tools.resources.temperature_levels.docs import (
    get_temperature_levels_docs,
)
from app.routes.v5.tools.resources.tools.docs import get_tools_docs
from app.routes.v5.tools.resources.voices.docs import get_voices_docs


async def docs_agent_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
) -> ComposedDocsResponse:
    """Agent docs using composable infra functions.

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
        models,
        prompts,
        instructions,
        flags,
        departments,
        tools,
        qualities,
        reasoning_levels,
        temperature_levels,
        rubrics,
        voices,
    ) = await asyncio.gather(
        get_agent_docs(conn),
        get_agent_drafts_docs(conn),
        get_names_docs(conn),
        get_descriptions_docs(conn),
        get_models_docs(conn),
        get_prompts_docs(conn),
        get_instructions_docs(conn),
        get_flags_docs(conn),
        get_departments_docs(conn),
        get_tools_docs(conn),
        get_qualities_docs(conn),
        get_reasoning_levels_docs(conn),
        get_temperature_levels_docs(conn),
        get_rubrics_docs(conn),
        get_voices_docs(conn),
    )

    # ── Step 3: Assemble response ──────────────────────────────────────

    # Lazy imports to avoid circular dependencies
    from app.infra.agent_permissions import (
        compute_can_create,
        compute_can_delete,
        compute_can_draft,
        compute_can_duplicate,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.agent.create import create_agent
    from app.routes.v5.api.main.agent.delete import delete_agent
    from app.routes.v5.api.main.agent.draft import patch_agent_draft
    from app.routes.v5.api.main.agent.duplicate import duplicate_agent
    from app.routes.v5.api.main.agent.export import export_agents
    from app.routes.v5.api.main.agent.get import get_agent
    from app.routes.v5.api.main.agent.save import save_agent
    from app.routes.v5.api.main.agent.search import search_agent
    from app.routes.v5.api.main.agent.update import update_agent

    return ComposedDocsResponse(
        name="agent",
        type="artifact",
        description=(
            "Agents define AI assistant configurations. "
            "Each agent links to resources (names, descriptions, models, prompts, "
            "instructions, departments, flags, tools, qualities, reasoning_levels, "
            "temperature_levels, rubrics, voices) via junction tables."
        ),
        artifact=artifact,
        entries=[drafts],
        resources=[
            names,
            descriptions,
            models,
            prompts,
            instructions,
            flags,
            departments,
            tools,
            qualities,
            reasoning_levels,
            temperature_levels,
            rubrics,
            voices,
        ],
        permissions=[
            get_operation_info(
                has_access,
                description="View access — user shares ANY department with the agent.",
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
                get_agent,
                description="POST /get — Get a single agent by ID with hydrated resources.",
            ),
            get_operation_info(
                search_agent,
                description="POST /search — Paginated agent search with filters.",
            ),
            get_operation_info(
                create_agent,
                description="POST /create — Create a new agent artifact.",
            ),
            get_operation_info(
                update_agent,
                description="POST /update — Update an existing agent's resource links.",
            ),
            get_operation_info(
                save_agent,
                description="POST /save — Create or update an agent (unified save).",
            ),
            get_operation_info(
                duplicate_agent,
                description="POST /duplicate — Duplicate an existing agent.",
            ),
            get_operation_info(
                delete_agent,
                description="POST /delete — Delete an agent.",
            ),
            get_operation_info(
                patch_agent_draft,
                description="PATCH /draft — Create or patch an agent draft (autosave).",
            ),
            get_operation_info(
                export_agents,
                description="POST /export — Export agents as denormalized CSV.",
            ),
        ],
    )
