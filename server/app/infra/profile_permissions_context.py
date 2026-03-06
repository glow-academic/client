"""Resolve profile permissions context — lightweight access + edit check.

Given a target_profile_id, fetches just the data needed for permission checks:
  1. get_profiles (artifact) → department_ids + profile_ids (resource IDs)
  2. search_cohorts → any active cohorts using this profile?

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.cohort.search import search_cohorts
from app.routes.v5.tools.artifacts.profile.get import (
    get_profiles as get_profile_artifacts,
)


@dataclass(frozen=True)
class ProfilePermissionsContext:
    """Lightweight context for profile permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_cohort_count: int


async def resolve_profile_permissions_context(
    conn: asyncpg.Connection,
    target_profile_id: UUID,
) -> ProfilePermissionsContext:
    """Fetch just what's needed for profile permission checks.

    Two black-box tool calls:
      1. get_profile_artifacts → department_ids + profile_ids (resource IDs)
      2. search_cohorts → any active cohorts using this profile?
    """
    artifacts = await get_profile_artifacts(
        conn,
        [target_profile_id],
        departments=True,
        profiles=True,
    )

    if not artifacts:
        return ProfilePermissionsContext(
            exists=False,
            department_ids=[],
            active_cohort_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    profile_resource_ids = list(artifact.profile_ids or [])

    # TODO: Refine — currently checks if any active cohort references this
    # profile. Eventually should check if this is the *last* profile in
    # the cohort before blocking removal.
    active_cohort_ids = (
        await search_cohorts(
            conn,
            profile_ids=profile_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if profile_resource_ids
        else []
    )

    return ProfilePermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_cohort_count=len(active_cohort_ids),
    )
