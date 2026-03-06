"""Resolve provider artifact context — merged junctions + hydrated resources.

Given a provider_id (and optional draft_id), fetches the published artifact
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
from app.routes.v5.tools.artifacts.provider.get import (
    get_providers as get_provider_artifacts,
)
from app.routes.v5.tools.entries.provider_drafts.get import get_provider_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.departments.get import get_departments

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.endpoints.get import get_endpoints
from app.routes.v5.tools.resources.endpoints.search import search_endpoints
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.keys.get import get_keys
from app.routes.v5.tools.resources.keys.search import search_keys
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.values.get import get_values
from app.routes.v5.tools.resources.values.search import search_values

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROVIDER_FLAG_NAMES = {
    "provider_active",
}


# ---------------------------------------------------------------------------
# resolve_provider_context
# ---------------------------------------------------------------------------


async def resolve_provider_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    provider_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve a provider artifact into fully hydrated resources for the GET endpoint.

    Steps:
      1. Fetch artifact + draft in parallel → merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Assemble ArtifactContext with ResourcePairs
    """
    user_dept_ids = user_department_ids or []

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_provider_artifacts(
            conn,
            [provider_id],
            names=True,
            descriptions=True,
            departments=True,
            flags=True,
            values=True,
            endpoints=True,
            keys=True,
        )
        if provider_id
        else _empty()
    )
    draft_task = get_provider_drafts(conn, [draft_id]) if draft_id else _empty()

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
        departments_selected,
        departments_suggestions,
        values_selected,
        values_suggestions,
        endpoints_selected,
        endpoints_suggestions,
        keys_selected,
        keys_suggestions,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            provider=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache,
            provider=True,
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
            provider=True,
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
        ),
        # Values
        get_values(conn, merged.value_ids, redis, bypass_cache),
        search_values(
            conn,
            redis,
            suggest_source="recent",
            exclude_ids=merged.value_ids,
            bypass_cache=bypass_cache,
            provider=True,
        ),
        # Endpoints
        get_endpoints(conn, merged.endpoint_ids, redis, bypass_cache),
        search_endpoints(
            conn,
            redis,
            exclude_ids=merged.endpoint_ids,
            bypass_cache=bypass_cache,
            provider=True,
        ),
        # Keys
        get_keys(conn, merged.key_ids, redis, bypass_cache),
        search_keys(
            conn,
            redis,
            exclude_ids=merged.key_ids,
            bypass_cache=bypass_cache,
            provider=True,
        ),
    )

    # Filter flags to provider-specific types
    flags_suggestions_filtered = [
        f for f in flags_suggestions if getattr(f, "name", None) in PROVIDER_FLAG_NAMES
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
            "departments": ResourcePair(
                selected=departments_selected, suggestions=departments_suggestions
            ),
            "values": ResourcePair(
                selected=values_selected, suggestions=values_suggestions
            ),
            "endpoints": ResourcePair(
                selected=endpoints_selected, suggestions=endpoints_suggestions
            ),
            "keys": ResourcePair(selected=keys_selected, suggestions=keys_suggestions),
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
    value_ids: list[UUID]
    endpoint_ids: list[UUID]
    key_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:  # noqa: ANN001
    """Merge artifact junction IDs with draft overrides."""
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    value_ids = list(artifact.value_ids or []) if artifact else []
    endpoint_ids = list(artifact.endpoint_ids or []) if artifact else []
    key_ids = list(artifact.key_ids or []) if artifact else []

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
        if draft.value_ids:
            value_ids = list(draft.value_ids)
        if draft.endpoint_ids:
            endpoint_ids = list(draft.endpoint_ids)
        if draft.key_ids:
            key_ids = list(draft.key_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        value_ids=value_ids,
        endpoint_ids=endpoint_ids,
        key_ids=key_ids,
    )


async def _empty() -> list:
    return []
