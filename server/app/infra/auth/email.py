"""Resolve profile by email — composes canonical black boxes.

Given an email address and optional actor profile_id:
  1. search_emails → find email resource matching the address
  2. search_profiles → find profile artifact owning that email
  3. resolve_profile_identity_context → hydrate full profile identity
  4. get_profile_artifacts → get created_at/updated_at timestamps

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


@dataclass(frozen=True)
class ProfileByEmailResult:
    """Result of a profile-by-email lookup."""

    profile_id: UUID
    name: str
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
    profile_ids, _total = await search_profiles(
        conn, email_ids=matching_email_ids, active_only=False, limit_count=1
    )
    if not profile_ids:
        return None

    target_profile_id = profile_ids[0]

    # Step 3: Hydrate profile identity + get timestamps
    identity = await resolve_profile_identity_context(
        conn, target_profile_id, redis, bypass_cache=bypass_cache
    )
    if not identity:
        return None

    # Step 4: Get artifact timestamps
    artifacts = await get_profile_artifacts(conn, [target_profile_id])
    created_at = artifacts[0].created_at if artifacts else None
    updated_at = artifacts[0].updated_at if artifacts else None

    # Step 5: Resolve actor name if actor_profile_id provided
    actor_name: str | None = None
    if actor_profile_id:
        actor_identity = await resolve_profile_identity_context(
            conn, actor_profile_id, redis, bypass_cache=bypass_cache
        )
        if actor_identity:
            actor_name = actor_identity.name

    return ProfileByEmailResult(
        profile_id=target_profile_id,
        name=identity.name,
        emails=identity.emails,
        primary_email=identity.primary_email,
        role=identity.role,
        active=identity.is_active,
        req_per_day=identity.requests_per_day,
        created_at=created_at,
        updated_at=updated_at,
        primary_department_id=identity.primary_department_id,
        actor_name=actor_name,
    )
