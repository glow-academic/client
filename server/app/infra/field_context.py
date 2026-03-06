"""Resolve field artifact context — merged junctions + hydrated resources.

Given a field_id (and optional draft_id), fetches the published artifact
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
from app.routes.v5.tools.artifacts.field.get import (
    get_fields as get_field_artifacts,
)
from app.routes.v5.tools.entries.field_drafts.get import get_field_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.conditional_parameters.get import (
    get_conditional_parameters,
)
from app.routes.v5.tools.resources.departments.get import get_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.parameters.get import get_parameters
from app.routes.v5.tools.resources.parameters.search import search_parameters

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.search import search_names


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FIELD_FLAG_NAMES = {"field_active"}


# ---------------------------------------------------------------------------
# resolve_field_context
# ---------------------------------------------------------------------------


async def resolve_field_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    field_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    descriptions_search: str | None = None,
    conditional_parameter_search: str | None = None,
    conditional_parameter_show_selected: bool | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve a field artifact into fully hydrated resources for the GET endpoint.

    Steps:
      1. Fetch artifact + draft in parallel → merge IDs
      2. Resolve conditional_parameter_resource IDs → parameter_artifact IDs
      3. Parallel hydrate: get (selected) + search (suggestions) per resource
      4. Assemble ArtifactContext with ResourcePairs
    """
    user_dept_ids = user_department_ids or []

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_field_artifacts(
            conn,
            [field_id],
            names=True,
            descriptions=True,
            departments=True,
            flags=True,
            conditional_parameters=True,
        )
        if field_id
        else _empty()
    )
    draft_task = get_field_drafts(conn, [draft_id]) if draft_id else _empty()

    artifacts, drafts = await asyncio.gather(artifact_task, draft_task)

    artifact = artifacts[0] if artifacts else None
    draft = drafts[0] if drafts else None

    # Merge IDs: start from published, draft overrides if present
    merged = _merge_junction_ids(artifact, draft)
    draft_version = draft.version if draft else None

    # Step 2: resolve conditional_parameter_resource IDs → parameter_artifact IDs
    cp_resources = await get_conditional_parameters(
        conn, merged.conditional_parameter_ids, redis, bypass_cache
    )
    selected_parameter_ids = [cp.parameter_id for cp in cp_resources if cp.parameter_id]

    # Step 3: parallel hydrate — selected + suggestions for each resource
    cp_exclude_ids = (
        []
        if (conditional_parameter_show_selected or False)
        else selected_parameter_ids
    )

    (
        names_selected,
        names_suggestions,
        descriptions_selected,
        descriptions_suggestions,
        flags_selected,
        flags_suggestions,
        departments_selected,
        departments_suggestions,
        parameters_selected,
        parameters_suggestions,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            field=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn,
            redis,
            search=descriptions_search,
            draft_id=group_id,
            exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache,
            field=True,
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
            field=True,
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
            suggest_source="all" if field_id is None else "recent",
            exclude_ids=merged.department_ids,
            bypass_cache=bypass_cache,
            field=True,
        ),
        # Conditional parameters (displayed as full parameter resources)
        get_parameters(conn, selected_parameter_ids, redis, bypass_cache),
        search_parameters(
            conn,
            redis,
            search=conditional_parameter_search,
            limit_count=20,
            offset_count=0,
            suggest_source="all",
            exclude_ids=cp_exclude_ids,
            bypass_cache=bypass_cache,
        ),
    )

    # Filter flags to field-specific types
    flags_suggestions_filtered = [
        f
        for f in flags_suggestions
        if getattr(f, "name", None) in FIELD_FLAG_NAMES
    ]

    return ArtifactContext(
        artifact_id=artifact.id if artifact else None,
        active=artifact.active if artifact else True,
        group_id=group_id,
        draft_version=draft_version,
        resources={
            "names": ResourcePair(
                selected=names_selected, suggestions=names_suggestions
            ),
            "descriptions": ResourcePair(
                selected=descriptions_selected, suggestions=descriptions_suggestions
            ),
            "flags": ResourcePair(
                selected=flags_selected, suggestions=flags_suggestions_filtered
            ),
            "departments": ResourcePair(
                selected=departments_selected, suggestions=departments_suggestions
            ),
            "conditional_parameters": ResourcePair(
                selected=parameters_selected, suggestions=parameters_suggestions
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
    flag_ids: list[UUID]
    department_ids: list[UUID]
    conditional_parameter_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides."""
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    conditional_parameter_ids = (
        list(artifact.conditional_parameter_ids or []) if artifact else []
    )

    # Draft overrides (if present) — ignore profile_ids from draft
    if draft:
        if draft.name_ids:
            name_ids = list(draft.name_ids)
        if draft.description_ids:
            description_ids = list(draft.description_ids)
        if draft.flag_ids:
            flag_ids = list(draft.flag_ids)
        if draft.department_ids:
            department_ids = list(draft.department_ids)
        if draft.conditional_parameter_ids:
            conditional_parameter_ids = list(draft.conditional_parameter_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        conditional_parameter_ids=conditional_parameter_ids,
    )


async def _empty() -> list:
    return []
