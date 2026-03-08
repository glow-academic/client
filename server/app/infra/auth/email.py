"""Resolve profile by email — composes canonical black boxes.

Given an email address and optional actor profile_id:
  1. search_emails → find email resource matching the address
  2. search_profiles → find profile artifact owning that email
  3. get_profile_artifacts → bridge artifact ID → resource ID + timestamps
  4. get_profiles (resource) → hydrate full profile data
  5. resolve_profile_identity_context → actor name (logged-in user only)

No inline SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.artifacts.profile.get import (
    get_profiles as get_profile_artifacts,
)
from app.routes.v5.tools.artifacts.profile.search import search_profiles
from app.routes.v5.tools.resources.emails.search import search_emails
from app.routes.v5.tools.resources.profiles.get import (
    get_profiles as get_profile_resources,
)


@dataclass(frozen=True)
class ProfileByEmailResult:
    """Result of a profile-by-email lookup."""

    profile_id: UUID
    name: str | None
    emails: list[str]
    primary_email: str | None
    role: str
    active: bool
    req_per_day: int | None
    created_at: datetime | None
    updated_at: datetime | None
    primary_department_id: UUID | None
    actor_name: str | None


async def resolve_profile_by_email(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    email: str,
    actor_profile_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ProfileByEmailResult | None:
    """Look up a profile by email using canonical black boxes.

    Returns None if no profile matches the email.
    """
    # Step 1: Find email resource matching the address
    email_results = await search_emails(
        conn, redis, search=email, limit_count=100, bypass_cache=bypass_cache
    )

    # Filter to exact match (search_emails does ILIKE substring matching)
    matching_email_ids = [
        e.id for e in email_results if e.email.lower() == email.lower()
    ]
    if not matching_email_ids:
        return None

    # Step 2: Find profile artifact owning that email
    artifact_ids, _total = await search_profiles(
        conn, email_ids=matching_email_ids, active_only=False, limit_count=1
    )
    if not artifact_ids:
        return None

    target_artifact_id = artifact_ids[0]

    # Step 3: Bridge artifact → resource ID + get timestamps
    artifacts = await get_profile_artifacts(
        conn, [target_artifact_id], profiles=True
    )
    if not artifacts or not artifacts[0].profile_ids:
        return None

    artifact = artifacts[0]
    resource_id = artifact.profile_ids[0]

    # Step 4: Hydrate profile via resource get_profiles
    profiles = await get_profile_resources(
        conn, [resource_id], redis, bypass_cache=bypass_cache
    )
    if not profiles:
        return None

    profile = profiles[0]

    # Step 5: Resolve actor name if actor_profile_id provided (logged-in user only)
    actor_name: str | None = None
    if actor_profile_id:
        actor_identity = await resolve_profile_identity_context(
            conn, actor_profile_id, redis, bypass_cache=bypass_cache
        )
        if actor_identity:
            actor_name = actor_identity.name

    # primary_department_id: first department from resource if available
    primary_department_id = (
        profile.department_ids[0] if profile.department_ids else None
    )

    return ProfileByEmailResult(
        profile_id=target_artifact_id,
        name=profile.name,
        emails=profile.emails,
        primary_email=profile.primary_email,
        role=profile.role,
        active=profile.active,
        req_per_day=profile.requests_per_day,
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
        primary_department_id=primary_department_id,
        actor_name=actor_name,
    )
