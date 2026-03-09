"""Resolve simulatable profiles — composes canonical black boxes.

Given a requester profile_id, limit, and optional search query:
  1. resolve_profile_identity_context → get requester role + actor name
  2. search_roles → get all roles, filter by hierarchy
  3. search_profiles (artifact) → find matching profiles by role + search
  4. resolve_profile_identity_context → hydrate each target profile

No inline SQL.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.artifacts.profile.search import search_profiles
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
    name: str
    emails: list[str]
    primary_email: str | None
    role: str
    active: bool
    req_per_day: int | None
    primary_department_id: UUID | None


@dataclass(frozen=True)
class SimulatableResult:
    """Result of a simulatable profiles search."""

    actor_name: str
    profiles: list[SimulatableProfile]


async def resolve_simulatable_profiles(
    pool: asyncpg.Pool,
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
    # Step 1: Get requester identity (logged-in user)
    identity = await resolve_profile_identity_context(
        pool, profile_id, redis, bypass_cache=bypass_cache
    )
    if not identity:
        raise ValueError(f"Profile not found: {profile_id}")

    requester_role = identity.role
    allowed_roles = SIMULATABLE_ROLES.get(requester_role, set())
    if not allowed_roles:
        return SimulatableResult(actor_name=identity.name, profiles=[])

    # Step 2: Search roles to resolve enum strings → role resource UUIDs
    async with pool.acquire() as conn:
        all_roles = await search_roles(
            conn, redis, limit_count=100, bypass_cache=bypass_cache
        )
    allowed_role_ids = [r.id for r in all_roles if r.role in allowed_roles]
    if not allowed_role_ids:
        return SimulatableResult(actor_name=identity.name, profiles=[])

    # Step 3: Search profile artifacts by role + text search, exclude requester
    search_text = query if query and query.strip() else None
    async with pool.acquire() as conn:
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

    # Step 4: Hydrate each target profile
    result_profiles: list[SimulatableProfile] = []
    for aid in artifact_ids:
        target = await resolve_profile_identity_context(
            pool, aid, redis, bypass_cache=bypass_cache
        )
        if not target:
            continue
        result_profiles.append(
            SimulatableProfile(
                profile_id=aid,
                name=target.name,
                emails=target.emails,
                primary_email=target.primary_email,
                role=target.role,
                active=target.is_active,
                req_per_day=target.requests_per_day,
                primary_department_id=target.primary_department_id,
            )
        )

    return SimulatableResult(actor_name=identity.name, profiles=result_profiles)
