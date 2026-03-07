"""Resolve profile artifact context — merged junctions + hydrated resources.

Given a target_profile_id (and optional draft_id), fetches the published artifact
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
from app.routes.v5.tools.artifacts.profile.get import (
    get_profiles as get_profile_artifacts,
)
from app.routes.v5.tools.entries.profile_drafts.get import get_profile_drafts

# Resource get fetchers (by known IDs)
from app.routes.v5.tools.resources.departments.get import get_departments

# Resource search fetchers (bounded, paginated)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.emails.get import get_emails
from app.routes.v5.tools.resources.emails.search import search_emails
from app.routes.v5.tools.resources.flags.get import get_flags
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.search import search_names
from app.routes.v5.tools.resources.request_limits.get import get_request_limits
from app.routes.v5.tools.resources.request_limits.search import search_request_limits
from app.routes.v5.tools.resources.roles.get import get_roles
from app.routes.v5.tools.resources.roles.search import search_roles

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

PROFILE_FLAG_TYPES = {
    "profile_active",
}


# ---------------------------------------------------------------------------
# resolve_profile_context
# ---------------------------------------------------------------------------


async def resolve_profile_context(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID | None,
    group_id: UUID,
    draft_id: UUID | None = None,
    user_department_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
) -> ArtifactContext:
    """Resolve a profile artifact into fully hydrated resources for the GET endpoint.

    Steps:
      1. Fetch artifact + draft in parallel → merge IDs
      2. Parallel hydrate: get (selected) + search (suggestions) per resource
      3. Assemble ArtifactContext with ResourcePairs
    """
    user_dept_ids = user_department_ids or []

    # Step 1: fetch artifact + draft in parallel
    artifact_task = (
        get_profile_artifacts(
            conn,
            [profile_id],
            names=True,
            departments=True,
            flags=True,
            emails=True,
            request_limits=True,
            roles=True,
        )
        if profile_id
        else _empty()
    )
    draft_task = get_profile_drafts(conn, [draft_id]) if draft_id else _empty()

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
        emails_selected,
        emails_suggestions,
        request_limits_selected,
        request_limits_suggestions,
        flags_selected,
        flags_suggestions,
        departments_selected,
        departments_suggestions,
        roles_selected,
        roles_suggestions,
    ) = await asyncio.gather(
        # Names
        get_names(conn, merged.name_ids, redis, bypass_cache),
        search_names(
            conn,
            redis,
            draft_id=group_id,
            exclude_ids=merged.name_ids,
            bypass_cache=bypass_cache,
            profile=True,
        ),
        # Emails
        get_emails(conn, merged.email_ids, redis, bypass_cache),
        search_emails(
            conn,
            redis,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.email_ids,
            bypass_cache=bypass_cache,
            profile=True,
        ),
        # Request limits
        get_request_limits(conn, merged.request_limit_ids, redis, bypass_cache),
        search_request_limits(
            conn,
            redis,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.request_limit_ids,
            bypass_cache=bypass_cache,
            profile=True,
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
            profile=True,
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
            suggest_source="all" if profile_id is None else "recent",
            exclude_ids=merged.department_ids,
            bypass_cache=bypass_cache,
        ),
        # Roles
        get_roles(conn, merged.role_ids, redis, bypass_cache),
        search_roles(
            conn,
            redis,
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=merged.role_ids,
            bypass_cache=bypass_cache,
            profile=True,
        ),
    )

    # Filter flags to profile-specific types
    flags_suggestions_filtered = [
        f for f in flags_suggestions if getattr(f, "type", None) in PROFILE_FLAG_TYPES
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
            "emails": ResourcePair(
                selected=emails_selected, suggestions=emails_suggestions
            ),
            "request_limits": ResourcePair(
                selected=request_limits_selected,
                suggestions=request_limits_suggestions,
            ),
            "flags": ResourcePair(
                selected=flags_selected, suggestions=flags_suggestions_filtered
            ),
            "departments": ResourcePair(
                selected=departments_selected, suggestions=departments_suggestions
            ),
            "roles": ResourcePair(
                selected=roles_selected, suggestions=roles_suggestions
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
    email_ids: list[UUID]
    request_limit_ids: list[UUID]
    flag_ids: list[UUID]
    department_ids: list[UUID]
    role_ids: list[UUID]


def _merge_junction_ids(artifact, draft) -> _MergedIds:
    """Merge artifact junction IDs with draft overrides."""
    name_ids = list(artifact.name_ids or []) if artifact else []
    email_ids = list(artifact.email_ids or []) if artifact else []
    request_limit_ids = list(artifact.request_limit_ids or []) if artifact else []
    flag_ids = list(artifact.flag_ids or []) if artifact else []
    department_ids = list(artifact.department_ids or []) if artifact else []
    role_ids = list(artifact.role_ids or []) if artifact else []

    # Draft overrides (if present)
    if draft:
        if draft.name_ids:
            name_ids = list(draft.name_ids)
        if draft.email_ids:
            email_ids = list(draft.email_ids)
        if draft.request_limit_ids:
            request_limit_ids = list(draft.request_limit_ids)
        if draft.flag_ids:
            flag_ids = list(draft.flag_ids)
        if draft.department_ids:
            department_ids = list(draft.department_ids)
        if draft.role_ids:
            role_ids = list(draft.role_ids)

    return _MergedIds(
        name_ids=name_ids,
        email_ids=email_ids,
        request_limit_ids=request_limit_ids,
        flag_ids=flag_ids,
        department_ids=department_ids,
        role_ids=role_ids,
    )


async def _empty() -> list:
    return []
