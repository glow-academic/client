"""Resolve persona artifact context — merged junctions + hydrated resources.

Given a persona_id (and optional draft_id), fetches the published artifact
and draft entry, merges junction IDs (draft overrides published), then
hydrates all resources in parallel (selected + suggestions).

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.types import ArtifactContext, ResourcePair

# Artifact + draft fetchers
from app.routes.v5.tools.artifacts.persona.get import (
    get_personas as get_persona_artifacts,
)
from app.routes.v5.tools.entries.persona_drafts.get import get_persona_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.colors.get import get_colors
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.examples.get import get_examples
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.icons.get import get_icons
from app.routes.v5.tools.resources.instructions.get import get_instructions
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.parameter_fields.get import get_parameter_fields
from app.routes.v5.tools.resources.parameters.get import get_parameters
from app.routes.v5.tools.resources.voices.get import get_voices

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.colors.search import search_colors
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.examples.search import search_examples
from app.routes.v5.tools.resources.fields.search import search_fields
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.icons.search import search_icons
from app.routes.v5.tools.resources.instructions.search import search_instructions
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.parameter_fields.search import (
    search_parameter_fields,
)
from app.routes.v5.tools.resources.parameters.search import search_parameters
from app.routes.v5.tools.resources.voices.search import search_voices

# Artifact search (for scenario count)
from app.routes.v5.tools.artifacts.scenario.search import search_scenarios


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

PERSONA_FLAG_TYPES = {"persona_active"}


# ---------------------------------------------------------------------------
# resolve_persona_context
# ---------------------------------------------------------------------------


async def resolve_persona_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    persona_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    parameter_ids: list[UUID] | None = None,
    # Search filters
    color_search: str | None = None,
    icon_search: str | None = None,
    descriptions_search: str | None = None,
    instructions_search: str | None = None,
    # Show-selected toggles
    color_show_selected: bool | None = None,
    icon_show_selected: bool | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve a persona artifact into fully hydrated resources.

    Steps:
      1. Fetch artifact + draft in parallel → merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Assemble ArtifactContext with ResourcePairs
    """
    user_dept_ids = user_department_ids or []
    param_ids = parameter_ids or []

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_persona_artifacts(
            conn,
            [persona_id],
            names=True,
            descriptions=True,
            colors=True,
            departments=True,
            examples=True,
            flags=True,
            icons=True,
            instructions=True,
            parameter_fields=True,
            personas=True,
            voices=True,
        )
        if persona_id
        else _empty()
    )
    draft_task = (
        get_persona_drafts(conn, [draft_id]) if draft_id else _empty()
    )

    artifacts, drafts = await asyncio.gather(artifact_task, draft_task)

    artifact = artifacts[0] if artifacts else None
    draft = drafts[0] if drafts else None

    # Merge IDs: start from published, draft overrides if present
    merged = _merge_junction_ids(artifact, draft)
    draft_version = draft.version if draft else None
    active = artifact.active if artifact else True
    personas_resource_ids = list(artifact.persona_ids or []) if artifact else []

    # Step 2: parallel hydrate — selected + suggestions for each resource
    # Also check if any active scenarios use this persona (via personas_resource IDs)
    (
        names_selected,
        names_suggestions,
        descriptions_selected,
        descriptions_suggestions,
        colors_selected,
        colors_suggestions,
        icons_selected,
        icons_suggestions,
        instructions_selected,
        instructions_suggestions,
        flags_selected,
        flags_suggestions,
        departments_selected,
        departments_suggestions,
        parameter_fields_selected,
        parameter_fields_suggestions,
        examples_selected,
        examples_suggestions,
        voices_selected,
        voices_suggestions,
        parameters_selected,
        parameters_suggestions,
        fields_catalog,
        active_scenario_ids,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn, redis, draft_id=group_id,
            exclude_ids=merged.name_ids, bypass_cache=bypass_cache, persona=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn, redis, search=descriptions_search, draft_id=group_id,
            suggest_source="all", exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache, persona=True,
        ),
        # Colors
        get_colors(conn, merged.color_ids, redis, bypass_cache),
        search_colors(
            conn, redis, search=color_search, limit_count=20, offset_count=0,
            draft_id=group_id,
            suggest_source="selected" if color_show_selected else "all",
            exclude_ids=merged.color_ids, bypass_cache=bypass_cache, persona=True,
        ),
        # Icons
        get_icons(conn, merged.icon_ids, redis, bypass_cache),
        search_icons(
            conn, redis, search=icon_search, limit_count=20, offset_count=0,
            draft_id=group_id,
            suggest_source="selected" if icon_show_selected else "all",
            exclude_ids=merged.icon_ids, bypass_cache=bypass_cache, persona=True,
        ),
        # Instructions
        get_instructions(conn, merged.instruction_ids, redis, bypass_cache),
        search_instructions(
            conn, redis, search=instructions_search, limit_count=20, offset_count=0,
            draft_id=group_id, suggest_source="all",
            exclude_ids=merged.instruction_ids, bypass_cache=bypass_cache, persona=True,
        ),
        # Flags
        get_flags(conn, merged.flag_ids, redis, bypass_cache),
        search_flags(
            conn, redis, search=None, limit_count=50, offset_count=0,
            exclude_ids=merged.flag_ids, bypass_cache=bypass_cache, persona=True,
        ),
        # Departments
        get_departments(conn, merged.department_ids, redis, bypass_cache),
        search_departments(
            conn, redis, search=None, limit_count=20, offset_count=0,
            department_ids=user_dept_ids, suggest_source="all",
            exclude_ids=merged.department_ids, bypass_cache=bypass_cache,
        ),
        # Parameter fields
        get_parameter_fields(conn, merged.parameter_field_ids, redis, bypass_cache),
        (
            search_parameter_fields(
                conn, redis, parameter_ids=param_ids, bypass_cache=bypass_cache,
            )
            if param_ids
            else _empty()
        ),
        # Examples
        get_examples(conn, merged.example_ids, redis, bypass_cache),
        search_examples(
            conn, redis, search=None, limit_count=20, offset_count=0,
            persona_id=persona_id, department_ids=user_dept_ids,
            draft_id=group_id, suggest_source="all",
            exclude_ids=merged.example_ids, bypass_cache=bypass_cache, persona=True,
        ),
        # Voices
        get_voices(conn, merged.voice_ids, redis, bypass_cache),
        search_voices(
            conn, redis, search=None, limit_count=20, offset_count=0,
            exclude_ids=merged.voice_ids, bypass_cache=bypass_cache,
        ),
        # Parameters (from URL, not saved state)
        get_parameters(conn, param_ids, redis, bypass_cache) if param_ids else _empty(),
        search_parameters(
            conn, redis, search=None, limit_count=20, offset_count=0,
            persona_parameter=True, document_parameter=None,
            scenario_parameter=None, video_parameter=None,
            suggest_source="all", exclude_ids=param_ids,
            bypass_cache=bypass_cache, persona=False,
        ),
        # Fields catalog
        search_fields(
            conn, redis, search=None, limit_count=200, offset_count=0,
            department_ids=user_dept_ids, bypass_cache=bypass_cache,
        ),
        # Scenario count: any active scenarios using this persona?
        (
            search_scenarios(
                conn,
                persona_ids=personas_resource_ids,
                active_only=True,
                limit_count=1,
            )
            if personas_resource_ids
            else _empty()
        ),
    )

    # Filter flags to persona-specific types
    flags_suggestions_filtered = [
        f for f in flags_suggestions if getattr(f, "type", None) in PERSONA_FLAG_TYPES
    ]

    return ArtifactContext(
        artifact_id=persona_id,
        active=active,
        group_id=group_id,
        draft_version=draft_version,
        resources={
            "names": ResourcePair(selected=names_selected, suggestions=names_suggestions),
            "descriptions": ResourcePair(selected=descriptions_selected, suggestions=descriptions_suggestions),
            "colors": ResourcePair(selected=colors_selected, suggestions=colors_suggestions),
            "icons": ResourcePair(selected=icons_selected, suggestions=icons_suggestions),
            "instructions": ResourcePair(selected=instructions_selected, suggestions=instructions_suggestions),
            "flags": ResourcePair(selected=flags_selected, suggestions=flags_suggestions_filtered),
            "departments": ResourcePair(selected=departments_selected, suggestions=departments_suggestions),
            "parameter_fields": ResourcePair(selected=parameter_fields_selected, suggestions=parameter_fields_suggestions),
            "examples": ResourcePair(selected=examples_selected, suggestions=examples_suggestions),
            "voices": ResourcePair(selected=voices_selected, suggestions=voices_suggestions),
            "parameters": ResourcePair(selected=parameters_selected, suggestions=parameters_suggestions),
            "fields": ResourcePair(selected=[], suggestions=fields_catalog),
        },
        entries={
            "personas_resource_ids": personas_resource_ids,
            "has_active_scenarios": len(active_scenario_ids) > 0,
        },
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


@dataclass
class _MergedIds:
    """Merged junction IDs from artifact + draft."""

    name_ids: list[UUID]
    description_ids: list[UUID]
    color_ids: list[UUID]
    icon_ids: list[UUID]
    instruction_ids: list[UUID]
    flag_ids: list[UUID]
    department_ids: list[UUID]
    parameter_field_ids: list[UUID]
    example_ids: list[UUID]
    voice_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides.

    For single-select resources (name, description, color, icon, instruction, flag):
      draft overrides if it has any IDs for that resource.
    For multi-select resources (departments, parameter_fields, examples, voices):
      draft overrides the entire list if it has any IDs for that resource.
    """
    # Start from artifact (published)
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    color_ids = list(artifact.color_ids or []) if artifact else []
    icon_ids = list(artifact.icon_ids or []) if artifact else []
    instruction_ids = list(artifact.instruction_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    parameter_field_ids = list(artifact.parameter_field_ids or []) if artifact else []
    example_ids = list(artifact.example_ids or []) if artifact else []
    voice_ids = list(artifact.voice_ids or []) if artifact else []

    # Draft overrides (if present)
    if draft:
        if draft.name_ids:
            name_ids = list(draft.name_ids)
        if draft.description_ids:
            description_ids = list(draft.description_ids)
        if draft.color_ids:
            color_ids = list(draft.color_ids)
        if draft.icon_ids:
            icon_ids = list(draft.icon_ids)
        if draft.instruction_ids:
            instruction_ids = list(draft.instruction_ids)
        if draft.flag_ids:
            flag_ids = list(draft.flag_ids)
        if draft.department_ids:
            department_ids = list(draft.department_ids)
        if draft.parameter_field_ids:
            parameter_field_ids = list(draft.parameter_field_ids)
        if draft.example_ids:
            example_ids = list(draft.example_ids)
        if draft.voice_ids:
            voice_ids = list(draft.voice_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        color_ids=color_ids,
        icon_ids=icon_ids,
        instruction_ids=instruction_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        parameter_field_ids=parameter_field_ids,
        example_ids=example_ids,
        voice_ids=voice_ids,
    )


async def _empty() -> list:
    return []
