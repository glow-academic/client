"""Resolve simulatable profiles — composes canonical black boxes.

Given a requester profile_id, limit, and optional search query:
  1. resolve_profile_identity_context → get requester role + actor name
  2. search_roles → get all roles, filter by hierarchy
  3. search_profiles (artifact) → find matching profiles by role + search
  4. get_profile_artifacts → bridge artifact IDs → resource IDs + timestamps
  5. get_profiles (resource) → hydrate full profile data

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
from app.routes.v5.tools.resources.profiles.get import (
    get_profiles as get_profile_resources,
)
from app.routes.v5.tools.resources.roles.search import search_roles

# Role hierarchy: who can simulate whom
SIMULATABLE_ROLES: dict[str, set[str]] = {
    "superadmin": {"superadmin", "admin", "instructional", "member", "guest"},
    "admin": {"instructional", "member", "guest"},
    "instructional": {"member", "guest"},
}


@dataclass(frozen=True)
class SimulatableProfile:
    """A single profile that can be simulated."""

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


@dataclass(frozen=True)
class SimulatableResult:
    """Result of a simulatable profiles search."""

    actor_name: str
    profiles: list[SimulatableProfile]


async def resolve_simulatable_profiles(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    limit_count: int = 20,
    query: str | None = None,
    bypass_cache: bool = False,
) -> SimulatableResult:
    """Search for profiles the requester can simulate.

    Raises ValueError if the requester profile is not found or has no
    permission to simulate anyone.
    """
    # Step 1: Get requester identity (logged-in user — correct use of identity context)
    identity = await resolve_profile_identity_context(
        conn, profile_id, redis, bypass_cache=bypass_cache
    )
    if not identity:
        raise ValueError(f"Profile not found: {profile_id}")

    requester_role = identity.role
    allowed_roles = SIMULATABLE_ROLES.get(requester_role, set())
    if not allowed_roles:
        return SimulatableResult(actor_name=identity.name, profiles=[])

    # Step 2: Search roles to resolve enum strings → role resource UUIDs
    all_roles = await search_roles(
        conn, redis, limit_count=100, bypass_cache=bypass_cache
    )
    allowed_role_ids = [r.id for r in all_roles if r.role in allowed_roles]
    if not allowed_role_ids:
        return SimulatableResult(actor_name=identity.name, profiles=[])

    # Step 3: Search profile artifacts by role + text search, exclude requester
    search_text = query if query and query.strip() else None
    artifact_ids, _total = await search_profiles(
        conn,
        role_ids=allowed_role_ids,
        exclude_ids=[profile_id],
        search=search_text,
        active_only=False,
        limit_count=limit_count,
    )
    if not artifact_ids:
        return SimulatableResult(actor_name=identity.name, profiles=[])

    # Step 4: Bridge artifact IDs → resource IDs + get timestamps
    artifacts = await get_profile_artifacts(
        conn, artifact_ids, profiles=True
    )

    # Build map: artifact_id → artifact (for timestamps)
    artifact_map = {a.id: a for a in artifacts}

    # Collect resource IDs (maintaining artifact order)
    resource_pairs: list[tuple[UUID, UUID]] = []  # (artifact_id, resource_id)
    for aid in artifact_ids:
        art = artifact_map.get(aid)
        if art and art.profile_ids:
            resource_pairs.append((aid, art.profile_ids[0]))

    if not resource_pairs:
        return SimulatableResult(actor_name=identity.name, profiles=[])

    resource_ids = [rid for _, rid in resource_pairs]

    # Step 5: Hydrate profiles via resource get_profiles
    profiles = await get_profile_resources(
        conn, resource_ids, redis, bypass_cache=bypass_cache
    )
    profile_map = {p.id: p for p in profiles}

    # Build result maintaining order
    result_profiles: list[SimulatableProfile] = []
    for artifact_id, resource_id in resource_pairs:
        profile = profile_map.get(resource_id)
        if not profile:
            continue
        art = artifact_map[artifact_id]
        primary_dept = (
            profile.department_ids[0] if profile.department_ids else None
        )
        result_profiles.append(
            SimulatableProfile(
                profile_id=artifact_id,
                name=profile.name,
                emails=profile.emails,
                primary_email=profile.primary_email,
                role=profile.role,
                active=profile.active,
                req_per_day=profile.requests_per_day,
                created_at=art.created_at,
                updated_at=art.updated_at,
                primary_department_id=primary_dept,
            )
        )

    return SimulatableResult(actor_name=identity.name, profiles=result_profiles)
