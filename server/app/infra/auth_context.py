"""Resolve auth artifact context — merged junctions + hydrated resources.

Given an auth_id (and optional draft_id), fetches the published artifact
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
from app.routes.v5.tools.artifacts.auth.get import (
    get_auths as get_auth_artifacts,
)
from app.routes.v5.tools.entries.auth_drafts.get import get_auth_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.items.get import get_items
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.protocols.get import get_protocols
from app.routes.v5.tools.resources.slugs.get import get_slugs

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.descriptions.search import search_descriptions
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.items.search import search_items
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.protocols.search import search_protocols
from app.routes.v5.tools.resources.slugs.search import search_slugs


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AUTH_FLAG_NAMES = {
    "auth_active",
}


# ---------------------------------------------------------------------------
# resolve_auth_context
# ---------------------------------------------------------------------------


async def resolve_auth_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    auth_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve an auth artifact into fully hydrated resources for the GET endpoint.

    Steps:
      1. Fetch artifact + draft in parallel → merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Assemble ArtifactContext with ResourcePairs
    """

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_auth_artifacts(
            conn,
            [auth_id],
            names=True,
            descriptions=True,
            departments=True,
            flags=True,
            items=True,
            protocols=True,
            slugs=True,
        )
        if auth_id
        else _empty()
    )
    draft_task = get_auth_drafts(conn, [draft_id]) if draft_id else _empty()

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
        protocols_selected,
        protocols_suggestions,
        slugs_selected,
        slugs_suggestions,
        items_selected,
        items_suggestions,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            auth=True,
        ),
        # Descriptions
        get_descriptions(conn, merged.description_ids, redis, bypass_cache),
        search_descriptions(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.description_ids,
            bypass_cache=bypass_cache,
            auth=True,
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
            auth=True,
        ),
        # Protocols
        get_protocols(conn, merged.protocol_ids, redis, bypass_cache),
        search_protocols(
            conn,
            redis,
            draft_id=group_id,
            suggest_source="recent",
            exclude_ids=merged.protocol_ids,
            bypass_cache=bypass_cache,
            auth=True,
        ),
        # Slugs
        get_slugs(conn, merged.slug_ids, redis, bypass_cache),
        search_slugs(
            conn,
            redis,
            draft_id=group_id,
            suggest_source="recent",
            exclude_ids=merged.slug_ids,
            bypass_cache=bypass_cache,
            auth=True,
        ),
        # Items
        get_items(conn, merged.item_ids, redis, bypass_cache),
        search_items(
            conn,
            redis,
            exclude_ids=merged.item_ids,
            bypass_cache=bypass_cache,
            auth=True,
        ),
    )

    # Filter flags to auth-specific types
    flags_suggestions_filtered = [
        f for f in flags_suggestions if getattr(f, "name", None) in AUTH_FLAG_NAMES
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
            "protocols": ResourcePair(
                selected=protocols_selected, suggestions=protocols_suggestions
            ),
            "slugs": ResourcePair(
                selected=slugs_selected, suggestions=slugs_suggestions
            ),
            "items": ResourcePair(
                selected=items_selected, suggestions=items_suggestions
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
    item_ids: list[UUID]
    protocol_ids: list[UUID]
    slug_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides."""
    name_ids = list(artifact.name_ids or []) if artifact else []
    description_ids = list(artifact.description_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    item_ids = list(artifact.item_ids or []) if artifact else []
    protocol_ids = list(artifact.protocol_ids or []) if artifact else []
    slug_ids = list(artifact.slug_ids or []) if artifact else []

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
        if draft.item_ids:
            item_ids = list(draft.item_ids)
        if draft.protocol_ids:
            protocol_ids = list(draft.protocol_ids)
        if draft.slug_ids:
            slug_ids = list(draft.slug_ids)

    return _MergedIds(
        name_ids=name_ids,
        description_ids=description_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        item_ids=item_ids,
        protocol_ids=protocol_ids,
        slug_ids=slug_ids,
    )


async def _empty() -> list:
    return []
