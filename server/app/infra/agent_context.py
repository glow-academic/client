"""Resolve agent artifact context — merged junctions + hydrated resources.

Given an agent_id (and optional draft_id), fetches the published artifact
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
from app.routes.v5.tools.artifacts.agent.get import (
    get_agents as get_agent_artifacts,
)
from app.routes.v5.tools.entries.agent_drafts.get import get_agent_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.instructions.get import get_instructions
from app.routes.v5.tools.resources.models.get import get_models
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.prompts.get import get_prompts
from app.routes.v5.tools.resources.qualities.get import get_qualities
from app.routes.v5.tools.resources.reasoning_levels.get import get_reasoning_levels
from app.routes.v5.tools.resources.rubrics.get import get_rubrics
from app.routes.v5.tools.resources.temperature_levels.get import get_temperature_levels
from app.routes.v5.tools.resources.tools.get import get_tools
from app.routes.v5.tools.resources.voices.get import get_voices

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.instructions.search import search_instructions
from app.routes.v5.tools.resources.models.search import search_models
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.prompts.search import search_prompts
from app.routes.v5.tools.resources.qualities.search import search_qualities
from app.routes.v5.tools.resources.reasoning_levels.search import search_reasoning_levels
from app.routes.v5.tools.resources.rubrics.search import search_rubrics
from app.routes.v5.tools.resources.temperature_levels.search import (
    search_temperature_levels,
)
from app.routes.v5.tools.resources.tools.search import search_tools
from app.routes.v5.tools.resources.voices.search import search_voices


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AGENT_FLAG_NAMES = {"agent_active"}


# ---------------------------------------------------------------------------
# resolve_agent_context
# ---------------------------------------------------------------------------


async def resolve_agent_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    agent_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve an agent artifact into fully hydrated resources for the GET endpoint.

    Steps:
      1. Fetch artifact + draft in parallel → merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Assemble ArtifactContext with ResourcePairs
    """
    user_dept_ids = user_department_ids or []

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_agent_artifacts(
            conn,
            [agent_id],
            names=True,
            descriptions=True,
            departments=True,
            flags=True,
            models=True,
            prompts=True,
            tools=True,
            temperature_levels=True,
            reasoning_levels=True,
            voices=True,
            qualities=True,
            rubrics=True,
        )
        if agent_id
        else _empty()
    )
    draft_task = get_agent_drafts(conn, [draft_id]) if draft_id else _empty()

    artifacts, drafts = await asyncio.gather(artifact_task, draft_task)

    artifact = artifacts[0] if artifacts else None
    draft = drafts[0] if drafts else None

    # Merge IDs: start from published, draft overrides if present
    merged = _merge_junction_ids(artifact, draft)
    draft_version = draft.version if draft else None
    active = artifact.active if artifact else True

    # Step 2: parallel hydrate — selected + suggestions for each resource
    (
        names_selected,
        names_suggestions,
        descriptions_selected,
        descriptions_suggestions,
        models_selected,
        models_suggestions,
        prompts_selected,
        prompts_suggestions,
        instructions_selected,
        instructions_suggestions,
        flags_selected,
        flags_suggestions,
        departments_selected,
        departments_suggestions,
        tools_selected,
        tools_suggestions,
        temperature_levels_selected,
        temperature_levels_suggestions,
        reasoning_levels_selected,
        reasoning_levels_suggestions,
        voices_selected,
        voices_suggestions,
        qualities_selected,
        qualities_suggestions,
        rubrics_selected,
        rubrics_suggestions,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn,
            redis,
            exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Models
        get_models(conn, merged.model_ids, redis, bypass_cache),
        search_models(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.model_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Prompts
        get_prompts(conn, merged.prompt_ids, redis, bypass_cache),
        search_prompts(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.prompt_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Instructions (no agent filter available)
        get_instructions(conn, merged.instruction_ids, redis, bypass_cache),
        search_instructions(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.instruction_ids,
            bypass_cache=bypass_cache,
        ),
        # Flags
        get_flags(conn, merged.flag_ids, redis, bypass_cache),
        search_flags(
            conn,
            redis,
            search=None,
            limit_count=50,
            offset_count=0,
            exclude_ids=merged.flag_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Departments
        get_departments(conn, merged.department_ids, redis, bypass_cache),
        search_departments(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            department_ids=user_dept_ids,
            suggest_source="all",
            exclude_ids=merged.department_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Tools
        get_tools(conn, merged.tool_ids, redis, bypass_cache),
        search_tools(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.tool_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Temperature levels
        get_temperature_levels(conn, merged.temperature_level_ids, redis, bypass_cache),
        search_temperature_levels(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.temperature_level_ids,
            bypass_cache=bypass_cache,
        ),
        # Reasoning levels
        get_reasoning_levels(conn, merged.reasoning_level_ids, redis, bypass_cache),
        search_reasoning_levels(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.reasoning_level_ids,
            bypass_cache=bypass_cache,
        ),
        # Voices
        get_voices(conn, merged.voice_ids, redis, bypass_cache),
        search_voices(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.voice_ids,
            bypass_cache=bypass_cache,
            agent=True,
        ),
        # Qualities (no agent filter available)
        get_qualities(conn, merged.quality_ids, redis, bypass_cache),
        search_qualities(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.quality_ids,
            bypass_cache=bypass_cache,
        ),
        # Rubrics
        get_rubrics(conn, merged.rubric_ids, redis, bypass_cache),
        search_rubrics(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.rubric_ids,
            bypass_cache=bypass_cache,
        ),
    )

    # Filter flags to agent-specific types
    flags_suggestions_filtered = [
        f for f in flags_suggestions if getattr(f, "name", None) in AGENT_FLAG_NAMES
    ]

    return ArtifactContext(
        artifact_id=artifact.id if artifact else None,
        active=active,
        group_id=group_id,
        draft_version=draft_version,
        resources={
            "names": ResourcePair(
                selected=names_selected, suggestions=names_suggestions
            ),
            "descriptions": ResourcePair(
                selected=descriptions_selected, suggestions=descriptions_suggestions
            ),
            "models": ResourcePair(
                selected=models_selected, suggestions=models_suggestions
            ),
            "prompts": ResourcePair(
                selected=prompts_selected, suggestions=prompts_suggestions
            ),
            "instructions": ResourcePair(
                selected=instructions_selected, suggestions=instructions_suggestions
            ),
            "flags": ResourcePair(
                selected=flags_selected, suggestions=flags_suggestions_filtered
            ),
            "departments": ResourcePair(
                selected=departments_selected, suggestions=departments_suggestions
            ),
            "tools": ResourcePair(
                selected=tools_selected, suggestions=tools_suggestions
            ),
            "temperature_levels": ResourcePair(
                selected=temperature_levels_selected,
                suggestions=temperature_levels_suggestions,
            ),
            "reasoning_levels": ResourcePair(
                selected=reasoning_levels_selected,
                suggestions=reasoning_levels_suggestions,
            ),
            "voices": ResourcePair(
                selected=voices_selected, suggestions=voices_suggestions
            ),
            "qualities": ResourcePair(
                selected=qualities_selected, suggestions=qualities_suggestions
            ),
            "rubrics": ResourcePair(
                selected=rubrics_selected, suggestions=rubrics_suggestions
            ),
        },
        entries={},
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


@dataclass
class _MergedIds:
    """Merged junction IDs from artifact + draft."""

    name_ids: list[UUID]
    description_ids: list[UUID]
    model_ids: list[UUID]
    prompt_ids: list[UUID]
    instruction_ids: list[UUID]
    flag_ids: list[UUID]
    department_ids: list[UUID]
    tool_ids: list[UUID]
    temperature_level_ids: list[UUID]
    reasoning_level_ids: list[UUID]
    voice_ids: list[UUID]
    quality_ids: list[UUID]
    rubric_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides.

    Draft overrides the entire list for a resource if it has any IDs.
    Ignores profile_ids from draft.
    """
    # Start from artifact (published)
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    model_ids = list(artifact.model_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    tool_ids = list(artifact.tool_ids or []) if artifact else []
    temperature_level_ids = (
        list(artifact.temperature_level_ids or []) if artifact else []
    )
    reasoning_level_ids = list(artifact.reasoning_level_ids or []) if artifact else []
    voice_ids = list(artifact.voice_ids or []) if artifact else []
    quality_ids = list(artifact.quality_ids or []) if artifact else []
    rubric_ids = list(artifact.rubric_ids or []) if artifact else []

    # Agent artifact does NOT store prompt_ids / instruction_ids in junctions
    # — prompts and instructions are content resources fetched via the junction
    # table. The artifact get tool doesn't return them, so we start empty.
    # However, the draft CAN have them (agent_drafts doesn't store prompts/instructions
    # in connections either in the current schema). We keep them empty from artifact.
    prompt_ids: list[UUID] = []
    instruction_ids: list[UUID] = []

    # Draft overrides (if present) — ignore profile_ids from draft
    if draft:
        if draft.name_ids:
            name_ids = list(draft.name_ids)
        if draft.description_ids:
            description_ids = list(draft.description_ids)
        if draft.model_ids:
            model_ids = list(draft.model_ids)
        if draft.flag_ids:
            flag_ids = list(draft.flag_ids)
        if draft.department_ids:
            department_ids = list(draft.department_ids)
        if draft.tool_ids:
            tool_ids = list(draft.tool_ids)
        if draft.temperature_level_ids:
            temperature_level_ids = list(draft.temperature_level_ids)
        if draft.reasoning_level_ids:
            reasoning_level_ids = list(draft.reasoning_level_ids)
        if draft.voice_ids:
            voice_ids = list(draft.voice_ids)
        if draft.quality_ids:
            quality_ids = list(draft.quality_ids)
        if draft.rubric_ids:
            rubric_ids = list(draft.rubric_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        model_ids=model_ids,
        prompt_ids=prompt_ids,
        instruction_ids=instruction_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        tool_ids=tool_ids,
        temperature_level_ids=temperature_level_ids,
        reasoning_level_ids=reasoning_level_ids,
        voice_ids=voice_ids,
        quality_ids=quality_ids,
        rubric_ids=rubric_ids,
    )


async def _empty() -> list:
    return []
