"""Resolve department artifact context — merged junctions + hydrated resources.

Given a department_id (and optional draft_id), fetches the published artifact
and draft entry, merges junction IDs (draft overrides published), then
hydrates all resources in parallel (selected + suggestions).

Department is special: it IS a department, so there is no "departments"
resource — the junction `department_departments_junction` is always empty.
Resources: names, descriptions, flags, settings (4 resources).

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
from app.routes.v5.tools.artifacts.department.get import (
    get_departments as get_department_artifacts,
)
from app.routes.v5.tools.entries.department_drafts.get import get_department_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.descriptions.get import get_descriptions

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.settings.get import get_settings

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEPARTMENT_FLAG_NAMES = {"department_active"}


# ---------------------------------------------------------------------------
# resolve_department_context
# ---------------------------------------------------------------------------


async def resolve_department_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    department_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve a department artifact into fully hydrated resources for the GET endpoint.

    Steps:
      1. Fetch artifact + draft in parallel -> merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Assemble ArtifactContext with ResourcePairs
    """

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_department_artifacts(
            conn,
            [department_id],
            names=True,
            descriptions=True,
            flags=True,
            settings=True,
        )
        if department_id
        else _empty()
    )
    draft_task = get_department_drafts(conn, [draft_id]) if draft_id else _empty()

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
        flags_selected,
        flags_suggestions,
        settings_selected,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            department=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache,
            department=True,
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
            department=True,
        ),
        # Settings (fetched by ID only, no search/suggestions)
        get_settings(conn, merged.settings_ids, redis, bypass_cache),
    )

    # Filter flags to department-specific types
    flags_suggestions_filtered = [
        f
        for f in flags_suggestions
        if getattr(f, "name", None) in DEPARTMENT_FLAG_NAMES
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
            "flags": ResourcePair(
                selected=flags_selected, suggestions=flags_suggestions_filtered
            ),
            "settings": ResourcePair(selected=settings_selected, suggestions=[]),
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
    settings_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides.

    Note: draft uses ``setting_ids`` (not ``settings_ids``) — matches the
    GetDepartmentDraftResponse field name from the connection table.
    """
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    settings_ids = list(artifact.settings_ids or []) if artifact else []

    # Draft overrides (if present)
    if draft:
        if draft.name_ids:
            name_ids = list(draft.name_ids)
        if draft.description_ids:
            description_ids = list(draft.description_ids)
        if draft.flag_ids:
            flag_ids = list(draft.flag_ids)
        if draft.setting_ids:
            settings_ids = list(draft.setting_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        flag_ids=flag_ids,
        settings_ids=settings_ids,
    )


async def _empty() -> list:
    return []
